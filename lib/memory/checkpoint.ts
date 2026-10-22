import type { AppState } from "../study/legacy";
import {
  validSession,
  upgradeCardSession,
  type CardSession,
  type SessionPresentation,
} from "./session";
export const closedSessionKey = (id: string) => "closedCardSession:" + id;
export function activeCardSession(
  settings: AppState["settings"],
): CardSession | null {
  const session = settings.activeCardSession;
  return validSession(session) && !settings[closedSessionKey(session.id)]
    ? upgradeCardSession(session)
    : null;
}
export function closeCardSession(
  state: AppState,
  id: string,
  now: number,
): AppState {
  return {
    ...state,
    settings: {
      ...state.settings,
      [closedSessionKey(id)]: new Date(now).toISOString(),
      ...(state.settings.activeCardSession?.id === id
        ? { activeCardSession: null }
        : {}),
    },
  };
}
export function saveSessionPresentation(
  state: AppState,
  id: string,
  turn: number,
  presentation: SessionPresentation,
  now: number,
): AppState {
  const session = activeCardSession(state.settings);
  // A delayed draft must not restore a closed/replaced session or overwrite a rating.
  if (!session || session.id !== id || session.turn !== turn) return state;
  const existing = new Set(state.cards.map((c) => c.id));
  const queue = presentation.queue.filter(
    (q) =>
      existing.has(q.cardId) && session.items.some((i) => i.id === q.cardId),
  );
  const current = presentation.queue[presentation.index];
  const index = current ? Math.max(0, queue.indexOf(current)) : queue.length;
  const view = { ...presentation, queue, index };
  const seen = new Set([
    ...queue.map((q) => q.cardId),
    ...(view.orthography?.groupIds ?? []),
  ]);
  return {
    ...state,
    settings: {
      ...state.settings,
      activeCardSession: {
        ...session,
        updatedAt: new Date(now).toISOString(),
        presentation: view,
        items: session.items
          .filter((i) => existing.has(i.id))
          .map((i) => (seen.has(i.id) ? { ...i, seen: true } : i)),
      },
    },
  };
}
export function restoredPresentation(
  session: CardSession,
  cards: AppState["cards"],
): SessionPresentation | null {
  const p = session.presentation;
  if (
    !p ||
    !Array.isArray(p.queue) ||
    !Number.isInteger(p.index) ||
    p.index < 0 ||
    p.index > p.queue.length
  )
    return null;
  const ids = new Set(cards.map((c) => c.id));
  if (session.format === "orthography") {
    if (
      !p.orthography?.groupIds?.every(
        (id) => ids.has(id) && session.items.some((i) => i.id === id),
      )
    )
      return null;
  } else if (p.index < p.queue.length) {
    const id = p.queue[p.index]?.cardId;
    if (!ids.has(id) || !session.items.some((i) => i.id === id)) return null;
  }
  const queue = p.queue.filter(
    (q) => ids.has(q.cardId) && session.items.some((i) => i.id === q.cardId),
  );
  const index =
    p.index < p.queue.length ? queue.indexOf(p.queue[p.index]) : queue.length;
  return { ...p, queue, index };
}
