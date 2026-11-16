"use client";
import { useMemo } from "react";
import ReviewSessionView, {
  type ReviewSessionProps,
} from "../review/ReviewSessionView";
import {
  parseStudyTable,
  validateStudyTable,
  tableKey,
  isTablePercentage,
} from "../../lib/tables/model";
import TableExercise from "./TableExercise";
import { prepareTableGrade } from "../../lib/tables/grading";
export default function TableReview(props: ReviewSessionProps) {
  const data = useMemo(() => {
    try {
      return {
        table: validateStudyTable(parseStudyTable(props.card.table)),
        error: "",
      };
    } catch (error) {
      return { table: null, error: (error as Error).message };
    }
  }, [props.card.table]);
  if (!data.table)
    return (
      <ReviewSessionView
        {...props}
        exerciseLabel="TABLA MUDA"
        exercise={
          <p role="alert">No se puede abrir esta tabla: {data.error}</p>
        }
        controls={
          <button
            type="button"
            className="primary-button full"
            onClick={props.onEdit}
          >
            Editar tabla
          </button>
        }
      />
    );
  const table = data.table;
  return (
    <TableExercise
      key={props.card.id + ":" + tableKey(table)}
      table={table}
      cardId={props.card.id}
      initial={props.tableAttempt}
      percentage={
        isTablePercentage(props.tablePercentage)
          ? props.tablePercentage
          : undefined
      }
      onChange={props.onTableChange}
      onCommit={(attempt) =>
        props.onTableGrade?.(prepareTableGrade(props.card, attempt).evaluation)
      }
      onSkip={props.onNext}
      busy={props.busy}
      readOnly={props.completed}
      render={(exercise, controls) => (
        <ReviewSessionView
          {...props}
          exerciseLabel="TABLA MUDA"
          exercise={exercise}
          controls={
            props.completed ? undefined : (
              <>
                {controls}
                <small className="score-help">{props.gradeHint}</small>
              </>
            )
          }
        />
      )}
    />
  );
}
