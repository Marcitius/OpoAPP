import type { Card } from "../study/legacy";
import { parseStudyTable, validateStudyTable } from "./model";
import { restoreTableAttempt, type TableAttempt } from "./learning";
export function prepareTableGrade(
  card: Card,
  attempt: TableAttempt | undefined,
) {
  if (card.type !== "table") throw Error("Esta tarjeta no es una tabla muda.");
  const table = validateStudyTable(parseStudyTable(card.table));
  const restored = restoreTableAttempt(table, card.id, attempt);
  if (!restored?.first || !restored.result)
    throw Error("Comprueba las respuestas antes de guardar la tabla.");
  return { evaluation: restored.first, attempt: restored };
}
