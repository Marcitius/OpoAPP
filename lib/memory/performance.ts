import type { AppState, Card } from "../study/legacy";
import {
  predictPersonalRecall,
  fitPersonalMemoryModel,
} from "../../app/memoryModel";
// Reuse equal JSON branches after a local/remote projection. Do not cache by ID:
// changed content, imports, deletions and account changes must remain observable.
export function shareJson<T>(previous: T, next: T): T {
  if (Object.is(previous, next)) return previous;
  if (
    !previous ||
    !next ||
    typeof previous !== "object" ||
    typeof next !== "object" ||
    Array.isArray(previous) !== Array.isArray(next)
  )
    return next;
  const a = previous as Record<string, unknown>,
    b = next as Record<string, unknown>;
  const keys = Object.keys(b);
  let equal = keys.length === Object.keys(a).length;
  const result: any = Array.isArray(next) ? [] : {};
  for (const key of keys) {
    const value = shareJson(a[key], b[key]);
    // Define own keys safely, including imported JSON keys named __proto__.
    Object.defineProperty(result, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    if (!Object.hasOwn(a, key) || value !== a[key]) equal = false;
  }
  return equal ? previous : (result as T);
}
export function orderedDueCards(
  cards: Card[],
  reviews: AppState["reviews"],
  model: ReturnType<typeof fitPersonalMemoryModel>,
  now: Date,
) {
  return cards
    .filter(
      (c) =>
        c.type !== "orthography" &&
        c.reviewCount > 0 &&
        Date.parse(c.dueAt) <= +now,
    )
    .map((card) => ({
      card,
      probability: predictPersonalRecall(card, reviews, model, now).probability,
    }))
    .sort((a, b) => a.probability - b.probability)
    .map((x) => x.card);
}
