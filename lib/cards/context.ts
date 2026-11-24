import type { AppState, Card } from "../study/legacy";
import { plainRichText } from "../../app/RichTextEditor";

export function snapshotCard(state: AppState, card: Card) {
  const byId = new Map(state.folders.map((f) => [f.id, f]));
  const seen = new Set<string>(),
    folderPath: string[] = [];
  let folder = byId.get(card.folderId);
  while (folder && !seen.has(folder.id)) {
    seen.add(folder.id);
    folderPath.unshift(folder.name);
    folder = folder.parentId ? byId.get(folder.parentId) : undefined;
  }
  return {
    type: card.type,
    folderPath,
    question: plainRichText(card.front),
    answer: plainRichText(card.back),
    options:
      card.type === "test" || card.type === "choice"
        ? card.options.map(plainRichText)
        : [],
    correctOptions: card.correctOptions?.length
      ? card.correctOptions
      : [card.correctOption],
  };
}
// Only learning content: grading, notes, location and scheduling are independent.
export function cardContentKey(card: Card) {
  const text = JSON.stringify(
    [
      card.type,
      card.front,
      card.back,
      card.options,
      card.correctOption,
      card.correctOptions,
      card.table,
      card.attachment,
      card.orthographyIsCorrect,
      card.orthographyCorrectForm,
      card.orthographyExplanation,
      card.orthographySource,
    ],
    (_key, value) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, value[key]]),
          )
        : value,
  );
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return `${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}:${text.length}`;
}
