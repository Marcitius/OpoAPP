"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  cellAnswer,
  evaluableCells,
  tableKey,
  tablePercentages,
  tableHtml,
  type StudyTable,
  type TablePercentage,
} from "../../lib/tables/model";
import {
  anotherTableCombination,
  checkTable,
  createTableAttempt,
  restoreTableAttempt,
  retryTable,
  type TableAttempt,
} from "../../lib/tables/learning";
import { formatScore, scoreGroups, scoreGroup } from "../../lib/memory/grades";
import BottomSheet from "../sheets/BottomSheet";
import { RichContent } from "../../app/RichTextEditor";
import TableContent from "./TableContent";

export default function TableExercise({
  table,
  cardId,
  initial,
  percentage,
  onChange,
  onCommit,
  onSkip,
  readOnly = false,
  busy = false,
  preview = false,
  render,
}: {
  table: StudyTable;
  cardId: string;
  initial?: TableAttempt | null;
  percentage?: TablePercentage;
  onChange?: (attempt: TableAttempt) => void;
  onCommit?: (attempt: TableAttempt) => void;
  onSkip?: () => void;
  readOnly?: boolean;
  busy?: boolean;
  preview?: boolean;
  render?: (content: ReactNode, controls: ReactNode) => ReactNode;
}) {
  const [attempt, setAttempt] = useState(
    () =>
      restoreTableAttempt(table, cardId, initial) ??
      createTableAttempt(table, cardId, percentage ?? table.percentage),
  );
  const current = useRef(attempt);
  current.current = attempt;
  const publish = useRef(onChange);
  publish.current = onChange;
  const update = (next: TableAttempt) => {
    current.current = next;
    setAttempt(next);
    if (!readOnly) publish.current?.(next);
  };
  useEffect(() => {
    if (!readOnly) publish.current?.(current.current);
  }, []);
  const [options, setOptions] = useState(false),
    [chosen, setChosen] = useState(attempt.percentage),
    [reset, setReset] = useState(false);
  const total = evaluableCells(table).length,
    first = attempt.first,
    result = attempt.result;
  const changeCombination = (value: TablePercentage) =>
    update(anotherTableCombination(table, current.current, value));
  const content = (
    <section
      className="table-exercise"
      aria-label={preview ? "Vista previa de tabla muda" : "Tabla muda"}
    >
      <div className="table-exercise-info">
        <span>
          {attempt.hiddenIds.length} campos ocultos · {attempt.percentage}%
        </span>
        {!readOnly && (
          <button
            type="button"
            className="ux-link"
            onClick={() => {
              setChosen(attempt.percentage);
              setOptions(true);
            }}
            disabled={busy}
          >
            Ocultación
          </button>
        )}
      </div>
      <TableContent
        table={table}
        attempt={attempt}
        readOnly={readOnly || busy}
        onAnswer={(id, value) => {
          if (current.current.result || readOnly || busy) return;
          update({
            ...current.current,
            answers: { ...current.current.answers, [id]: value },
          });
        }}
      />
      {result && (
        <div
          className="table-result"
          role="status"
          aria-label="Resultado de la tabla"
        >
          <strong>{formatScore(result.score)} / 10</strong>
          <span>
            {result.correct} aciertos · {result.incorrect} errores
            {result.blank ? ` · ${result.blank} sin responder` : ""}
          </span>
          <small>
            {
              scoreGroups.find((group) => group.id === scoreGroup(result.score))
                ?.label
            }
          </small>
        </div>
      )}
      {first && (!result || attempt.practiceCount > 0) && (
        <p className="score-help">
          Práctica de refuerzo. Se conserva la primera nota de este intento:{" "}
          {formatScore(first.score)} / 10 ({first.percentage}% oculto).
        </p>
      )}
      {result && (
        <details className="table-full-solution">
          <summary>Ver tabla completa</summary>
          <div className="study-table-scroll">
            <RichContent html={tableHtml(table)} />
          </div>
        </details>
      )}
      {preview && (
        <p className="score-help">
          Vista previa: no guarda notas ni historial.
        </p>
      )}
      {options && (
        <BottomSheet
          title="Ocultación de la tabla"
          onClose={() => setOptions(false)}
        >
          <p>
            Se eligen al azar entre las celdas evaluables. La combinación se
            mantiene mientras respondes.
          </p>
          <div
            className="table-percentage-options"
            role="group"
            aria-label="Porcentaje de celdas ocultas"
          >
            {tablePercentages.map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={chosen === value}
                onClick={() => setChosen(value)}
              >
                {value}%
              </button>
            ))}
          </div>
          <button
            type="button"
            className="primary-button full"
            onClick={() => {
              setOptions(false);
              if (chosen === current.current.percentage) return;
              if (
                Object.values(current.current.answers).some(Boolean) &&
                !current.current.result
              )
                setReset(true);
              else changeCombination(chosen);
            }}
          >
            Aplicar
          </button>
        </BottomSheet>
      )}
      {reset && (
        <BottomSheet
          title="Cambiar combinación"
          onClose={() => setReset(false)}
        >
          <p>
            Se vaciarán las respuestas escritas de esta combinación.
            {first ? " La primera nota se conserva." : ""}
          </p>
          <button
            type="button"
            className="primary-button full"
            onClick={() => {
              setReset(false);
              changeCombination(chosen);
            }}
          >
            Cambiar y vaciar
          </button>
        </BottomSheet>
      )}
    </section>
  );
  const controls = (
    <div className="table-study-controls">
      {!readOnly && (
        <>
          {result ? (
            <>
              {!preview && onCommit && (
                <button
                  type="button"
                  className="primary-button full"
                  disabled={busy || !first}
                  onClick={() => onCommit(current.current)}
                >
                  {busy
                    ? "Guardando…"
                    : `Guardar ${formatScore(first?.score)} y continuar`}
                </button>
              )}
              <div className="table-secondary-controls">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => update(retryTable(current.current))}
                >
                  Reintentar
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() =>
                    update(
                      checkTable(
                        table,
                        current.current,
                        new Date().toISOString(),
                        true,
                      ),
                    )
                  }
                >
                  Mostrar soluciones
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className="primary-button full"
                disabled={busy || !total}
                onClick={() =>
                  update(
                    checkTable(
                      table,
                      current.current,
                      new Date().toISOString(),
                    ),
                  )
                }
              >
                Comprobar respuestas
              </button>
              <div className="table-secondary-controls">
                <button
                  type="button"
                  className="ux-link"
                  disabled={busy || !total}
                  onClick={() =>
                    update(
                      checkTable(
                        table,
                        current.current,
                        new Date().toISOString(),
                        true,
                      ),
                    )
                  }
                >
                  Mostrar soluciones
                </button>
                {onSkip && (
                  <button
                    type="button"
                    className="ux-link"
                    disabled={busy}
                    onClick={onSkip}
                  >
                    Pasar
                  </button>
                )}
              </div>
            </>
          )}
          {attempt.hiddenIds.length < total && (
            <button
              type="button"
              className="ux-link table-new-combination"
              disabled={busy}
              onClick={() => {
                setChosen(current.current.percentage);
                if (
                  Object.values(current.current.answers).some(Boolean) &&
                  !current.current.result
                )
                  setReset(true);
                else changeCombination(current.current.percentage);
              }}
            >
              Nueva combinación
            </button>
          )}
        </>
      )}
    </div>
  );
  return render ? (
    render(content, controls)
  ) : (
    <>
      {content}
      {controls}
    </>
  );
}
