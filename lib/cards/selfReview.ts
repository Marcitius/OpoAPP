import type { TableAttempt } from "../tables/learning";
// A review of one's answer cannot turn blanks, revealed answers, or a later
// practice attempt into a correct independent first answer.
export function canSelfAcceptTable(attempt: TableAttempt | null | undefined) {
  return (
    !!attempt?.first &&
    !!attempt.result &&
    attempt.practiceCount === 0 &&
    attempt.first.fields.length > 0 &&
    attempt.first.fields.every((f) => !!f.given.trim() && !f.revealed)
  );
}
export const selfReviewLabel =
  "Después de revisar mi respuesta, considero que es correcta";
