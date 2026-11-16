"use client";
import { memo, useEffect, useMemo, useState } from "react";
import {
  RichContent,
  plainRichText,
  sanitizeRichHtml,
} from "../../app/RichTextEditor";
import CardTextEditor from "../editor/CardTextEditor";
import BottomSheet from "../sheets/BottomSheet";
import {
  addTableColumn,
  addTableRow,
  cellAnswer,
  editTableCell,
  evaluableCells,
  markTableColumn,
  pastedStudyTable,
  removeTableColumn,
  removeTableRow,
  tableKey,
  tablePercentages,
  emptyStudyTable,
  type StudyTable,
  type TableCell,
} from "../../lib/tables/model";
import TableExercise from "./TableExercise";
const CellContent = memo(RichContent);

export default function TableEditor({
  value: supplied,
  onChange,
}: {
  value?: StudyTable;
  onChange: (table: StudyTable) => void;
}) {
  const [initial] = useState(emptyStudyTable);
  const value = supplied ?? initial;
  const cellText = useMemo(
    () =>
      new Map(
        value.rows
          .flatMap((row) => row.cells)
          .map((cell) => [cell.id, plainRichText(cell.html)]),
      ),
    [value],
  );
  useEffect(() => {
    if (!supplied) onChange(initial);
  }, [supplied, initial, onChange]);
  const [editing, setEditing] = useState<TableCell | null>(null),
    [html, setHtml] = useState(""),
    [answer, setAnswer] = useState(""),
    [alternatives, setAlternatives] = useState(""),
    [evaluable, setEvaluable] = useState(false);
  const [paste, setPaste] = useState(false),
    [raw, setRaw] = useState(""),
    [rich, setRich] = useState(""),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(false);
  const edit = (cell: TableCell) => {
    setEditing(cell);
    setHtml(cell.html);
    setAnswer(cell.answer ?? "");
    setAlternatives(cell.alternatives.join("\n"));
    setEvaluable(cell.evaluable);
  };
  return (
    <div className="table-card-editor" aria-label="Editor de tabla muda">
      <div className="table-editor-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => onChange(addTableRow(value))}
        >
          + Fila
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => onChange(addTableColumn(value))}
        >
          + Columna
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setError("");
            setPaste(true);
          }}
        >
          Pegar tabla
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setPreview(true)}
          disabled={!evaluableCells(value).length}
        >
          Vista previa
        </button>
      </div>
      <p className="field-help">
        Toca una celda para editarla. Marca las respuestas evaluables o
        selecciona una columna completa.
      </p>
      <div
        className="study-table-scroll table-grid-editor"
        role="region"
        aria-label="Celdas de la tabla"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Filas</th>
              {value.columns.map((id, column) => {
                const data = value.rows.filter(
                    (_, r) => !value.headerRow || r > 0,
                  ),
                  all =
                    data.length > 0 &&
                    data.every((row) => row.cells[column].evaluable);
                return (
                  <th key={id}>
                    <span>Columna {column + 1}</span>
                    <div>
                      <button
                        type="button"
                        aria-label={`${all ? "Dejar de evaluar" : "Evaluar"} columna ${column + 1}`}
                        aria-pressed={all}
                        onClick={() =>
                          onChange(markTableColumn(value, column, !all))
                        }
                      >
                        ✓ Evaluar
                      </button>
                      <button
                        type="button"
                        aria-label={`Eliminar columna ${column + 1}`}
                        disabled={value.columns.length <= 1}
                        onClick={() => onChange(removeTableColumn(value, id))}
                      >
                        ×
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {value.rows.map((row, r) => (
              <tr key={row.id}>
                <th>
                  <span>
                    {value.headerRow && !r ? "Cabecera" : `Fila ${r + 1}`}
                  </span>
                  <button
                    type="button"
                    aria-label={`Eliminar fila ${r + 1}`}
                    disabled={value.rows.length <= 1}
                    onClick={() => onChange(removeTableRow(value, row.id))}
                  >
                    ×
                  </button>
                </th>
                {row.cells.map((cell, c) => (
                  <td
                    key={cell.id}
                    className={cell.evaluable ? "evaluable" : ""}
                  >
                    <button
                      type="button"
                      className="table-edit-cell"
                      aria-label={`Editar celda fila ${r + 1} columna ${c + 1}`}
                      onClick={() => edit(cell)}
                    >
                      {cellText.get(cell.id) ? (
                        <CellContent html={cell.html} />
                      ) : (
                        <span className="table-cell-placeholder">
                          Añadir contenido
                        </span>
                      )}
                    </button>
                    <label className="table-evaluable-toggle">
                      <input
                        type="checkbox"
                        checked={cell.evaluable}
                        onChange={(e) =>
                          onChange(
                            editTableCell(value, {
                              ...cell,
                              evaluable: e.target.checked,
                            }),
                          )
                        }
                        aria-label={`Evaluar celda fila ${r + 1} columna ${c + 1}`}
                      />{" "}
                      Evaluable
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="table-header-toggle">
        <input
          type="checkbox"
          checked={value.headerRow}
          onChange={(e) => onChange({ ...value, headerRow: e.target.checked })}
        />{" "}
        Primera fila como cabecera
      </label>
      <fieldset className="table-percentage-default">
        <legend>Respuestas ocultas al empezar</legend>
        <div className="table-percentage-options">
          {tablePercentages.map((percentage) => (
            <button
              type="button"
              key={percentage}
              aria-pressed={value.percentage === percentage}
              onClick={() => onChange({ ...value, percentage })}
            >
              {percentage}%
            </button>
          ))}
        </div>
      </fieldset>
      <p className="score-help">
        {evaluableCells(value).length} celdas evaluables · Una sola tarjeta y
        una nota global.
      </p>
      {editing && (
        <BottomSheet
          title="Editar celda"
          fullScreen
          onClose={() => setEditing(null)}
        >
          <CardTextEditor
            fieldName="Celda"
            value={html}
            onChange={setHtml}
            placeholder="Contenido de la celda"
          />
          <label className="table-header-toggle">
            <input
              type="checkbox"
              checked={evaluable}
              onChange={(e) => setEvaluable(e.target.checked)}
            />{" "}
            Esta celda es evaluable
          </label>
          {evaluable && (
            <>
              <label>
                Respuesta principal
                <input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={
                    plainRichText(html) || "El contenido de la celda"
                  }
                />
              </label>
              <p className="field-help">
                Si la dejas vacía, se utiliza el texto de la celda.
              </p>
              <label>
                Alternativas admitidas
                <textarea
                  aria-label="Alternativas admitidas"
                  value={alternatives}
                  onChange={(e) => setAlternatives(e.target.value)}
                  placeholder="Una alternativa por línea"
                  rows={3}
                />
              </label>
            </>
          )}
          <button
            type="button"
            className="primary-button full"
            disabled={evaluable && !answer.trim() && !plainRichText(html)}
            onClick={() => {
              const cell: TableCell = {
                id: editing.id,
                html: sanitizeRichHtml(html),
                evaluable,
                alternatives: alternatives
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              };
              if (answer.trim()) cell.answer = answer.trim();
              onChange(editTableCell(value, cell));
              setEditing(null);
            }}
          >
            Guardar celda
          </button>
        </BottomSheet>
      )}
      {paste && (
        <BottomSheet
          title="Pegar una tabla"
          fullScreen
          onClose={() => setPaste(false)}
        >
          <p>
            Pega una tabla de ChatGPT, Word o una hoja de cálculo. Después
            podrás marcar las celdas o columnas evaluables.
          </p>
          <textarea
            aria-label="Tabla para pegar"
            rows={10}
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setRich("");
            }}
            onPaste={(e) => {
              const content = e.clipboardData.getData("text/html");
              if (!/<table[\s>]/i.test(content)) return;
              e.preventDefault();
              setRaw(e.clipboardData.getData("text/plain"));
              setRich(content);
            }}
          />
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button
            type="button"
            className="primary-button full"
            disabled={!raw.trim() && !rich}
            onClick={() => {
              try {
                onChange(pastedStudyTable(raw, rich));
                setPaste(false);
                setRaw("");
                setRich("");
                setError("");
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            Usar tabla
          </button>
        </BottomSheet>
      )}
      {preview && (
        <BottomSheet
          title="Vista previa de tabla muda"
          fullScreen
          onClose={() => setPreview(false)}
        >
          <TableExercise
            key={tableKey(value)}
            table={value}
            cardId="preview"
            preview
          />
        </BottomSheet>
      )}
    </div>
  );
}
