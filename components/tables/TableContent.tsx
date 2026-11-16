"use client";
import { memo, useId, useMemo } from "react";
import { RichContent, plainRichText } from "../../app/RichTextEditor";
import { cellAnswer, type StudyTable } from "../../lib/tables/model";
import type { TableAttempt } from "../../lib/tables/learning";
const CellContent = memo(RichContent);

export default function TableContent({
  table,
  attempt,
  onAnswer,
  readOnly = false,
}: {
  table: StudyTable;
  attempt: TableAttempt;
  onAnswer: (id: string, value: string) => void;
  readOnly?: boolean;
}) {
  const prefix = useId();
  const layout = useMemo(() => {
    const hidden = new Set(attempt.hiddenIds),
      numbers = new Map(attempt.hiddenIds.map((id, i) => [id, i + 1]));
    const cells = new Map(
      table.rows
        .flatMap((row) => row.cells)
        .map((cell) => [
          cell.id,
          { hasText: !!plainRichText(cell.html), answer: cellAnswer(cell) },
        ]),
    );
    const labels = new Map(
      table.rows.map((row) => [
        row.id,
        plainRichText(
          row.cells.find((cell) => !hidden.has(cell.id))?.html ?? "",
        ).slice(0, 80),
      ]),
    );
    return { hidden, numbers, cells, labels };
  }, [table, attempt.hiddenIds]);
  const results = useMemo(
    () => new Map(attempt.result?.fields.map((field) => [field.id, field])),
    [attempt.result],
  );
  const row = (r: StudyTable["rows"][number], index: number) => (
    <tr key={r.id}>
      {r.cells.map((cell, column) => {
        const Tag = table.headerRow && !index ? "th" : "td",
          result = results.get(cell.id),
          active = layout.hidden.has(cell.id),
          number = layout.numbers.get(cell.id),
          info = layout.cells.get(cell.id)!,
          label = layout.labels.get(r.id);
        return (
          <Tag key={cell.id} data-evaluable={cell.evaluable || undefined}>
            {active ? (
              <div
                className={`table-answer-field ${result ? (result.correct ? "correct" : "incorrect") : ""}`}
              >
                <label className="sr-only" htmlFor={`${prefix}-${cell.id}`}>
                  Hueco {number}
                  {label ? `: ${label}` : ""}
                </label>
                <input
                  id={`${prefix}-${cell.id}`}
                  value={attempt.answers[cell.id] ?? ""}
                  onChange={(e) => onAnswer(cell.id, e.target.value)}
                  readOnly={readOnly || !!attempt.result}
                  aria-invalid={result ? !result.correct : undefined}
                  aria-describedby={
                    result ? `${prefix}-${cell.id}-feedback` : undefined
                  }
                  placeholder="Tu respuesta"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode={/^\d+$/.test(info.answer) ? "numeric" : "text"}
                />
                {result && (
                  <div
                    id={`${prefix}-${cell.id}-feedback`}
                    className="table-cell-feedback"
                  >
                    <strong>
                      {result.correct
                        ? "✓ Correcta"
                        : result.blank
                          ? "— Sin responder"
                          : "× Incorrecta"}
                    </strong>
                    {(!result.correct || attempt.solutions) && (
                      <span>Solución: {result.expected}</span>
                    )}
                  </div>
                )}
              </div>
            ) : info.hasText ? (
              <CellContent html={cell.html} />
            ) : cell.evaluable ? (
              <span>{info.answer}</span>
            ) : null}
          </Tag>
        );
      })}
    </tr>
  );
  return (
    <div
      className="study-table-scroll"
      role="region"
      aria-label="Tabla para completar"
      tabIndex={0}
    >
      <table className="interactive-study-table">
        {table.headerRow && <thead>{row(table.rows[0], 0)}</thead>}
        <tbody>
          {table.rows
            .slice(table.headerRow ? 1 : 0)
            .map((r, i) => row(r, i + (table.headerRow ? 1 : 0)))}
        </tbody>
      </table>
    </div>
  );
}
