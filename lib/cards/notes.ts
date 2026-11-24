import type { AppState, Review } from "../study/legacy";
import { snapshotCard } from "./context";
export interface CardNote {
  version: 1;
  id: string;
  cardId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  sessionId?: string;
  resolvedAt?: string | null;
  deletedAt?: string;
  content: NonNullable<Review["cardSnapshot"]>;
}
export interface CardNoteEvent {
  version: 1;
  id: string;
  at: string;
  action: "created" | "edited" | "resolved" | "reopened" | "deleted";
  note: CardNote;
}
export const noteKey = (id: string) => "cardNote:" + id;
export function cardNotes(
  settings: AppState["settings"],
  cardId?: string,
  includeDeleted = false,
): CardNote[] {
  return Object.entries(settings)
    .filter(
      ([k, n]) =>
        k === noteKey(n?.id) &&
        n?.version === 1 &&
        typeof n.cardId === "string" &&
        typeof n.text === "string" &&
        (!cardId || n.cardId === cardId) &&
        (includeDeleted || !n.deletedAt),
    )
    .map(([, n]) => n as CardNote)
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
    );
}
export function noteEvents(settings: AppState["settings"]): CardNoteEvent[] {
  return Object.entries(settings)
    .filter(
      ([k, e]) =>
        k === "cardNoteEvent:" + e?.id &&
        e?.version === 1 &&
        typeof e.at === "string" &&
        e.note?.id &&
        e.note?.cardId,
    )
    .map(([, e]) => e as CardNoteEvent);
}
export function saveCardNote(
  state: AppState,
  input: { id: string; cardId: string; text: string; sessionId?: string },
  eventId: string,
  now: string,
): AppState {
  const card = state.cards.find((c) => c.id === input.cardId);
  if (!card) throw Error("La tarjeta ya no está disponible.");
  const text = input.text.trim();
  if (!text) throw Error("Escribe una nota.");
  if (text.length > 10000)
    throw Error("La nota admite hasta 10.000 caracteres.");
  const old = cardNotes(state.settings, input.cardId, true).find(
    (n) => n.id === input.id,
  );
  if (old?.deletedAt) throw Error("Esta nota se ha eliminado.");
  if (old && old.text === text) return state;
  const note: CardNote = old
    ? { ...old, text, updatedAt: now }
    : {
        version: 1,
        ...input,
        text,
        createdAt: now,
        updatedAt: now,
        content: snapshotCard(state, card),
      };
  const event: CardNoteEvent = {
    version: 1,
    id: eventId,
    at: now,
    action: old ? "edited" : "created",
    note,
  };
  return {
    ...state,
    settings: {
      ...state.settings,
      [noteKey(note.id)]: note,
      ["cardNoteEvent:" + eventId]: event,
    },
  };
}
export function changeCardNote(
  state: AppState,
  id: string,
  action: "resolve" | "reopen" | "delete",
  eventId: string,
  now: string,
): AppState {
  const old = cardNotes(state.settings).find((n) => n.id === id);
  if (!old) return state;
  const note = {
    ...old,
    updatedAt: now,
    ...(action === "delete"
      ? { deletedAt: now }
      : { resolvedAt: action === "resolve" ? now : null }),
  };
  const event: CardNoteEvent = {
    version: 1,
    id: eventId,
    at: now,
    action:
      action === "resolve"
        ? "resolved"
        : action === "reopen"
          ? "reopened"
          : "deleted",
    note,
  };
  return {
    ...state,
    settings: {
      ...state.settings,
      [noteKey(id)]: note,
      ["cardNoteEvent:" + eventId]: event,
    },
  };
}
