import DOMPurify from "isomorphic-dompurify";
import { plainRichText, sanitizeRichHtml } from "../../app/RichTextEditor";
import { markdownToMaterial } from "../material/format";

export const tablePercentages = [25, 50, 75, 100] as const;
export type TablePercentage = (typeof tablePercentages)[number];
export interface TableCell {
  id: string;
  html: string;
  evaluable: boolean;
  answer?: string;
  alternatives: string[];
}
export interface TableRow {
  id: string;
  cells: TableCell[];
}
export interface StudyTable {
  version: 1;
  columns: string[];
  rows: TableRow[];
  headerRow: boolean;
  percentage: TablePercentage;
}
export const isTablePercentage = (value: unknown): value is TablePercentage =>
  tablePercentages.includes(value as TablePercentage);
export const cellAnswer = (cell: TableCell) =>
  (cell.answer ?? plainRichText(cell.html)).trim();
export const evaluableCells = (table: StudyTable) =>
  table.rows.flatMap((row) => row.cells).filter((cell) => cell.evaluable);
export function normalizeTableAnswer(value: string) {
  // Acentos are optional; ñ remains a different letter (año is not ano).
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/n\u0303/g, "ñ")
    .replace(/\p{M}/gu, "")
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .trim();
}
export function tableKey(table: StudyTable) {
  // JSONB may reorder object keys between devices. Use an ordered value model.
  const text = JSON.stringify([
    table.version,
    table.columns,
    table.headerRow,
    table.percentage,
    table.rows.map((row) => [
      row.id,
      row.cells.map((cell) => [
        cell.id,
        cell.html,
        cell.evaluable,
        cell.answer ?? null,
        cell.alternatives,
      ]),
    ]),
  ]);
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(text.length - i - 1);
  }
  return `table-v1-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}-${text.length}`;
}
export function tableHtml(table: StudyTable) {
  return (
    "<table><tbody>" +
    table.rows
      .map(
        (row, index) =>
          "<tr>" +
          row.cells
            .map((cell) => {
              const tag = table.headerRow && !index ? "th" : "td";
              const html = sanitizeRichHtml(cell.html);
              const content =
                cell.evaluable && !plainRichText(html)
                  ? cellAnswer(cell)
                      .replaceAll("&", "&amp;")
                      .replaceAll("<", "&lt;")
                      .replaceAll(">", "&gt;")
                  : html;
              return `<${tag}>${content}</${tag}>`;
            })
            .join("") +
          "</tr>",
      )
      .join("") +
    "</tbody></table>"
  );
}
export const tableId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const blankCell = (id: string, html = ""): TableCell => ({
  id,
  html,
  evaluable: false,
  alternatives: [],
});
export function emptyStudyTable(id = tableId): StudyTable {
  return {
    version: 1,
    columns: [id(), id()],
    headerRow: true,
    percentage: 100,
    rows: [
      {
        id: id(),
        cells: [
          blankCell(id(), "<p>Concepto</p>"),
          blankCell(id(), "<p>Respuesta</p>"),
        ],
      },
      { id: id(), cells: [blankCell(id()), blankCell(id())] },
      { id: id(), cells: [blankCell(id()), blankCell(id())] },
    ],
  };
}
export function addTableRow(table: StudyTable, id = tableId): StudyTable {
  return {
    ...table,
    rows: [
      ...table.rows,
      { id: id(), cells: table.columns.map(() => blankCell(id())) },
    ],
  };
}
export function addTableColumn(table: StudyTable, id = tableId): StudyTable {
  return {
    ...table,
    columns: [...table.columns, id()],
    rows: table.rows.map((row) => ({
      ...row,
      cells: [...row.cells, blankCell(id())],
    })),
  };
}
export function removeTableRow(table: StudyTable, id: string): StudyTable {
  if (table.rows.length <= 1) return table;
  const index = table.rows.findIndex((row) => row.id === id);
  return {
    ...table,
    headerRow: index === 0 ? false : table.headerRow,
    rows: table.rows.filter((row) => row.id !== id),
  };
}
export function removeTableColumn(table: StudyTable, id: string): StudyTable {
  if (table.columns.length <= 1) return table;
  const index = table.columns.indexOf(id);
  if (index < 0) return table;
  return {
    ...table,
    columns: table.columns.filter((col) => col !== id),
    rows: table.rows.map((row) => ({
      ...row,
      cells: row.cells.filter((_, i) => i !== index),
    })),
  };
}
export function editTableCell(table: StudyTable, cell: TableCell): StudyTable {
  return {
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      cells: row.cells.map((old) => (old.id === cell.id ? cell : old)),
    })),
  };
}
export function markTableColumn(
  table: StudyTable,
  index: number,
  evaluable: boolean,
): StudyTable {
  return {
    ...table,
    rows: table.rows.map((row, i) =>
      table.headerRow && !i
        ? row
        : {
            ...row,
            cells: row.cells.map((cell, j) =>
              j === index ? { ...cell, evaluable } : cell,
            ),
          },
    ),
  };
}
function identifier(value: unknown, fallback: string) {
  const id = String(value ?? fallback);
  if (!/^[a-zA-Z0-9_:-]{1,160}$/.test(id))
    throw Error("Los identificadores de la tabla no son válidos.");
  return id;
}
function parseCell(value: any, id: string): TableCell {
  const data =
    typeof value === "string" || typeof value === "number"
      ? { contenido: String(value) }
      : value;
  if (!data || typeof data !== "object")
    throw Error("Cada celda necesita un contenido.");
  const alternatives = data.alternatives ?? data.alternativas ?? [];
  if (
    !Array.isArray(alternatives) ||
    alternatives.some((x) => typeof x !== "string")
  )
    throw Error("Las alternativas de una celda deben ser una lista de textos.");
  const html =
    typeof data.html === "string"
      ? sanitizeRichHtml(data.html)
      : markdownToMaterial(String(data.contenido ?? data.texto ?? ""));
  const expected = data.answer ?? data.respuesta ?? data.respuestaCorrecta;
  const cell: TableCell = {
    id: identifier(data.id, id),
    html,
    evaluable: data.evaluable === true,
    alternatives: alternatives.map((x) => x.trim()).filter(Boolean),
  };
  if (expected !== undefined && expected !== null)
    cell.answer = String(expected).trim();
  return cell;
}
// Native backups retain IDs. The friendly JSON uses columnas/filas and may omit IDs.
export function parseStudyTable(value: any): StudyTable {
  if (!value || typeof value !== "object")
    throw Error("Falta el objeto tabla de la tabla muda.");
  if (value.version !== undefined && value.version !== 1)
    throw Error("Versión de tabla no compatible.");
  let table: StudyTable;
  const percentage = value.percentage ?? value.porcentajeOculto ?? 100;
  if (!isTablePercentage(percentage))
    throw Error("El porcentaje de ocultación debe ser 25, 50, 75 o 100.");
  if (Array.isArray(value.rows) && Array.isArray(value.columns)) {
    if (value.version !== 1) throw Error("Versión de tabla no compatible.");
    table = {
      version: 1,
      columns: value.columns.map((id: unknown, i: number) =>
        identifier(id, `col-${i + 1}`),
      ),
      headerRow: value.headerRow !== false,
      percentage,
      rows: value.rows.map((row: any, r: number) => {
        if (!row || !Array.isArray(row.cells))
          throw Error("Cada fila necesita una lista de celdas.");
        return {
          id: identifier(row.id, `row-${r + 1}`),
          cells: row.cells.map((cell: any, c: number) =>
            parseCell(cell, `cell-${r + 1}-${c + 1}`),
          ),
        };
      }),
    };
  } else {
    if (!Array.isArray(value.columnas) || !Array.isArray(value.filas))
      throw Error("La tabla necesita columnas y filas.");
    const rows = [value.columnas, ...value.filas];
    if (rows.some((row) => !Array.isArray(row)))
      throw Error("Cada fila debe ser una lista de celdas.");
    table = {
      version: 1,
      columns: value.columnas.map((_: unknown, i: number) => `col-${i + 1}`),
      headerRow: value.encabezados !== false,
      percentage,
      rows: rows.map((row: any[], r: number) => ({
        id: `row-${r + 1}`,
        cells: row.map((cell, c) => parseCell(cell, `cell-${r + 1}-${c + 1}`)),
      })),
    };
  }
  if (!table.columns.length || !table.rows.length)
    throw Error("La tabla necesita al menos una fila y una columna.");
  if (table.rows.some((row) => row.cells.length !== table.columns.length))
    throw Error("Todas las filas deben tener el mismo número de columnas.");
  for (const ids of [
    table.columns,
    table.rows.map((row) => row.id),
    table.rows.flatMap((row) => row.cells.map((cell) => cell.id)),
  ])
    if (new Set(ids).size !== ids.length)
      throw Error("Hay identificadores repetidos dentro de la tabla.");
  return table;
}
export function validateStudyTable(table: StudyTable) {
  const clean = parseStudyTable(table),
    cells = evaluableCells(clean);
  if (!cells.length) throw Error("Marca al menos una celda como evaluable.");
  if (cells.some((cell) => !cellAnswer(cell)))
    throw Error("Las celdas evaluables necesitan una respuesta correcta.");
  return clean;
}
export function pastedStudyTable(text: string, rich = ""): StudyTable {
  let html =
    rich && /<table[\s>]/i.test(rich)
      ? sanitizeRichHtml(rich)
      : markdownToMaterial(text);
  const root = DOMPurify.sanitize(html, { RETURN_DOM: true }) as HTMLElement;
  let source = root.querySelector("table");
  if (!source && text.includes("\t")) {
    const lines = text
      .replace(/\r\n?/g, "\n")
      .trim()
      .split("\n")
      .map((line) => line.split("\t"));
    const cols = lines[0]?.length ?? 0;
    if (!cols || lines.some((line) => line.length !== cols))
      throw Error("Las filas pegadas tienen distinto número de columnas.");
    return parseStudyTable({ columnas: lines[0], filas: lines.slice(1) });
  }
  if (!source)
    throw Error(
      "Pega una tabla de Markdown, Word, ChatGPT o una hoja de cálculo.",
    );
  const rows = Array.from(source.rows).map((row, r) => ({
    id: `row-${r + 1}`,
    cells: Array.from(row.cells).map((cell, c) => {
      if (cell.colSpan !== 1 || cell.rowSpan !== 1)
        throw Error(
          "Para evaluar celdas, pega la tabla sin celdas combinadas.",
        );
      return parseCell({ html: cell.innerHTML }, `cell-${r + 1}-${c + 1}`);
    }),
  }));
  const width = rows[0]?.cells.length ?? 0;
  return parseStudyTable({
    version: 1,
    columns: Array.from({ length: width }, (_, i) => `col-${i + 1}`),
    rows,
    headerRow: !!source.rows[0]?.querySelector("th"),
    percentage: 100,
  });
}
export function exportStudyTable(table: StudyTable) {
  const cell = (c: TableCell) => ({
    id: c.id,
    html: c.html,
    evaluable: c.evaluable,
    ...(c.answer !== undefined ? { respuesta: c.answer } : {}),
    alternativas: [...c.alternatives],
  });
  return {
    version: 1,
    columns: [...table.columns],
    rows: table.rows.map((row) => ({ id: row.id, cells: row.cells.map(cell) })),
    headerRow: table.headerRow,
    porcentajeOculto: table.percentage,
  };
}
