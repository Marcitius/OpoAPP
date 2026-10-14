import type { AppState, Card } from "../study/legacy";
export type ReviewCollection = { id: string; name: string; deleted?: boolean };
const defaults: ReviewCollection[] = [
  { id: "next", name: "Repasar próximamente" },
  { id: "mal", name: "Mal" },
  { id: "regular", name: "Regular" },
  { id: "bien", name: "Bien" },
];
export const collectionKey = (id: string) => "reviewCollection:" + id;
export const membershipKey = (id: string, card: string) =>
  "reviewMembership:" + encodeURIComponent(id) + ":" + encodeURIComponent(card);
export function reviewCollections(
  settings: AppState["settings"],
): ReviewCollection[] {
  const result = new Map(defaults.map((c) => [c.id, c]));
  for (const [key, v] of Object.entries(settings))
    if (
      key.startsWith("reviewCollection:") &&
      v &&
      typeof v === "object" &&
      typeof v.name === "string"
    )
      result.set(key.slice(17), {
        id: key.slice(17),
        name: v.name,
        deleted: !!v.deleted,
      });
  return [...result.values()].filter((c) => !c.deleted);
}
export const inCollection = (
  s: AppState["settings"],
  id: string,
  card: string,
) => s[membershipKey(id, card)] === true;
export function assignCollection(
  s: AppState,
  id: string,
  ids: string[],
  saved: boolean,
): AppState {
  if (!reviewCollections(s.settings).some((c) => c.id === id))
    throw new Error("No se encuentra la colección.");
  const settings = { ...s.settings },
    existing = new Set(s.cards.map((c) => c.id));
  for (const card of new Set(ids))
    if (existing.has(card)) settings[membershipKey(id, card)] = saved;
  return { ...s, settings };
}
export function saveCollection(s: AppState, c: ReviewCollection): AppState {
  if (!c.name.trim()) throw new Error("Escribe un nombre.");
  return {
    ...s,
    settings: {
      ...s.settings,
      [collectionKey(c.id)]: { name: c.name.trim(), deleted: !!c.deleted },
    },
  };
}
export const cardsInCollection = (s: AppState, id: string): Card[] =>
  s.cards.filter((c) => inCollection(s.settings, id, c.id));
