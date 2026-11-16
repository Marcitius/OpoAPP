"use client";
import { lazy, Suspense } from "react";
import ReviewSessionView, {
  type ReviewSessionProps,
} from "./ReviewSessionView";
const TableReview = lazy(() => import("../tables/TableReview"));
export default function ReviewSession(props: ReviewSessionProps) {
  if (props.card.type !== "table") return <ReviewSessionView {...props} />;
  return (
    <Suspense
      fallback={
        <ReviewSessionView
          {...props}
          exerciseLabel="TABLA MUDA"
          exercise={<p role="status">Preparando tabla…</p>}
          controls={
            <button className="primary-button full" disabled>
              Preparando tabla…
            </button>
          }
        />
      }
    >
      <TableReview {...props} />
    </Suspense>
  );
}
