import {
  cellAnswer,
  evaluableCells,
  isTablePercentage,
  normalizeTableAnswer,
  tableKey,
  type StudyTable,
  type TablePercentage,
} from "./model";
import type { Rating } from "../study/legacy";
export interface TableFieldResult {
  id: string;
  row: number;
  column: number;
  rowLabel: string;
  columnLabel: string;
  expected: string;
  alternatives: string[];
  given: string;
  correct: boolean;
  blank: boolean;
  revealed: boolean;
}
export interface TableEvaluation {
  version: 1;
  tableKey: string;
  percentage: TablePercentage;
  hiddenIds: string[];
  fields: TableFieldResult[];
  evaluated: number;
  correct: number;
  incorrect: number;
  blank: number;
  revealedWithoutAnswer: number;
  score: number;
  checkedAt: string;
}
export interface TableAttempt {
  version: 1;
  cardId: string;
  tableKey: string;
  percentage: TablePercentage;
  seed: number;
  hiddenIds: string[];
  answers: Record<string, string>;
  result: TableEvaluation | null;
  first: TableEvaluation | null;
  solutions: boolean;
  practiceCount: number;
}
export function validTableScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 10
  );
}
export function tableScoreRating(value: number): Rating {
  if (!validTableScore(value)) throw Error("Nota de tabla no válida.");
  return value < 5 ? "again" : value < 7 ? "hard" : value < 9 ? "good" : "easy";
}
export const hiddenCellCount = (total: number, percentage: TablePercentage) =>
  total
    ? Math.max(1, Math.min(total, Math.round((total * percentage) / 100)))
    : 0;
function seeded(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function createTableAttempt(
  table: StudyTable,
  cardId: string,
  percentage = table.percentage,
  random = Math.random,
): TableAttempt {
  const seed = Math.floor(random() * 4294967296) >>> 0,
    rng = seeded(seed);
  const cells = evaluableCells(table),
    ids = cells.map((cell) => cell.id),
    count = hiddenCellCount(ids.length, percentage);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const selected = new Set(ids.slice(0, count));
  return {
    version: 1,
    cardId,
    tableKey: tableKey(table),
    percentage,
    seed,
    hiddenIds: cells
      .filter((cell) => selected.has(cell.id))
      .map((cell) => cell.id),
    answers: {},
    result: null,
    first: null,
    solutions: false,
    practiceCount: 0,
  };
}
export function evaluateTable(
  table: StudyTable,
  attempt: Pick<TableAttempt, "percentage" | "hiddenIds" | "answers">,
  checkedAt: string,
  revealedIds: string[] = [],
): TableEvaluation {
  const all = new Map(evaluableCells(table).map((cell) => [cell.id, cell])),
    revealed = new Set(revealedIds);
  const positions = new Map(
    table.rows.flatMap((row, r) =>
      row.cells.map(
        (cell, c) =>
          [
            cell.id,
            {
              row: r + 1,
              column: c + 1,
              rowLabel: cellAnswer(
                row.cells.find((value) => !value.evaluable) ?? cell,
              ),
              columnLabel:
                table.headerRow && r > 0
                  ? cellAnswer(table.rows[0].cells[c])
                  : "",
            },
          ] as const,
      ),
    ),
  );
  const fields = attempt.hiddenIds.map((id) => {
    const cell = all.get(id);
    if (!cell) throw Error("La tabla ha cambiado. Vuelve a abrirla.");
    const given = String(attempt.answers[id] ?? ""),
      normalized = normalizeTableAnswer(given),
      blank = !normalized;
    const expected = cellAnswer(cell),
      correct =
        !blank &&
        !revealed.has(id) &&
        [expected, ...cell.alternatives].some(
          (value) => normalizeTableAnswer(value) === normalized,
        );
    return {
      id,
      ...positions.get(id)!,
      expected,
      alternatives: [...cell.alternatives],
      given,
      blank,
      correct,
      revealed: revealed.has(id),
    };
  });
  const correct = fields.filter((f) => f.correct).length;
  return {
    version: 1,
    tableKey: tableKey(table),
    percentage: attempt.percentage,
    hiddenIds: [...attempt.hiddenIds],
    fields,
    evaluated: fields.length,
    correct,
    incorrect: fields.length - correct,
    blank: fields.filter((f) => f.blank).length,
    revealedWithoutAnswer: fields.filter((f) => f.revealed && f.blank).length,
    score: fields.length ? (10 * correct) / fields.length : 0,
    checkedAt,
  };
}
export function checkTable(
  table: StudyTable,
  attempt: TableAttempt,
  now: string,
  reveal = false,
): TableAttempt {
  if (attempt.result) return reveal ? { ...attempt, solutions: true } : attempt;
  const revealedIds = reveal
    ? attempt.hiddenIds.filter(
        (id) => !normalizeTableAnswer(attempt.answers[id] ?? ""),
      )
    : [];
  const result = evaluateTable(table, attempt, now, revealedIds);
  return {
    ...attempt,
    result,
    first: attempt.first ?? result,
    solutions: reveal,
    practiceCount: attempt.practiceCount + (attempt.first ? 1 : 0),
  };
}
export function retryTable(attempt: TableAttempt): TableAttempt {
  return { ...attempt, answers: {}, result: null, solutions: false };
}
export function anotherTableCombination(
  table: StudyTable,
  attempt: TableAttempt,
  percentage = attempt.percentage,
  random = Math.random,
): TableAttempt {
  let next = createTableAttempt(table, attempt.cardId, percentage, random);
  const all = evaluableCells(table).map((cell) => cell.id);
  if (
    next.hiddenIds.length < all.length &&
    next.hiddenIds.length === attempt.hiddenIds.length &&
    next.hiddenIds.every((id) => attempt.hiddenIds.includes(id))
  ) {
    const selected = new Set(next.hiddenIds);
    selected.delete(next.hiddenIds.at(-1)!);
    selected.add(all.find((id) => !next.hiddenIds.includes(id))!);
    next = { ...next, hiddenIds: all.filter((id) => selected.has(id)) };
  }
  return {
    ...next,
    first: attempt.first,
    practiceCount: attempt.practiceCount,
  };
}
export function restoredTableEvaluation(
  table: StudyTable,
  value: unknown,
): TableEvaluation | null {
  const v = value as TableEvaluation;
  if (
    !v ||
    v.version !== 1 ||
    v.tableKey !== tableKey(table) ||
    !isTablePercentage(v.percentage) ||
    !Array.isArray(v.hiddenIds) ||
    !Array.isArray(v.fields) ||
    !Number.isFinite(Date.parse(v.checkedAt))
  )
    return null;
  const ids = evaluableCells(table).map((cell) => cell.id);
  if (
    v.hiddenIds.length !== hiddenCellCount(ids.length, v.percentage) ||
    new Set(v.hiddenIds).size !== v.hiddenIds.length ||
    v.hiddenIds.some((id) => !ids.includes(id))
  )
    return null;
  if (
    v.fields.length !== v.hiddenIds.length ||
    v.fields.some(
      (f, i) => f.id !== v.hiddenIds[i] || typeof f.given !== "string",
    )
  )
    return null;
  const result = evaluateTable(
    table,
    {
      percentage: v.percentage,
      hiddenIds: v.hiddenIds,
      answers: Object.fromEntries(v.fields.map((f) => [f.id, f.given])),
    },
    v.checkedAt,
    v.fields.filter((f) => f.revealed).map((f) => f.id),
  );
  if (result.score !== v.score || result.correct !== v.correct) return null;
  return result;
}
export function restoreTableAttempt(
  table: StudyTable,
  cardId: string,
  value: unknown,
): TableAttempt | null {
  const v = value as TableAttempt;
  if (
    !v ||
    v.version !== 1 ||
    v.cardId !== cardId ||
    v.tableKey !== tableKey(table) ||
    !isTablePercentage(v.percentage) ||
    !Array.isArray(v.hiddenIds) ||
    !v.answers ||
    typeof v.answers !== "object" ||
    !Number.isInteger(v.seed)
  )
    return null;
  const cells = evaluableCells(table);
  if (
    v.hiddenIds.length !== hiddenCellCount(cells.length, v.percentage) ||
    new Set(v.hiddenIds).size !== v.hiddenIds.length ||
    v.hiddenIds.some((id) => !cells.some((c) => c.id === id))
  )
    return null;
  const first = v.first ? restoredTableEvaluation(table, v.first) : null,
    result = v.result ? restoredTableEvaluation(table, v.result) : null;
  if ((v.first && !first) || (v.result && !result)) return null;
  return {
    ...v,
    hiddenIds: [...v.hiddenIds],
    answers: Object.fromEntries(
      v.hiddenIds
        .filter((id) => typeof v.answers[id] === "string")
        .map((id) => [id, v.answers[id]]),
    ),
    first,
    result,
    solutions: !!v.solutions,
    practiceCount:
      Number.isInteger(v.practiceCount) && v.practiceCount >= 0
        ? v.practiceCount
        : 0,
  };
}
