import type { AppState } from "../study/legacy";
import {
  validSession,
  upgradeCardSession,
  type CardSession,
  type SessionPresentation,
} from "./session";
export const closedSessionKey = (id: string) => "closedCardSession:" + id;
// Each session is an independent settings record, so updating one does not
// replace the other sessions through the existing offline/sync projection.
export const cardSessionKey = (id: string) => "cardSession:" + id;
export function savedCardSessions(
  settings: Record<string, unknown>,
): CardSession[] {
  const sessions = new Map<string, CardSession>();
  const legacy = settings.activeCardSession;
  if (validSession(legacy)) sessions.set(legacy.id, legacy);
  for (const [key, value] of Object.entries(settings)) {
    if (
      key.startsWith("cardSession:") &&
      validSession(value) &&
      key === cardSessionKey(value.id)
    )
      sessions.set(value.id, value);
  }
  return [...sessions.values()]
    .filter((s) => !settings[closedSessionKey(s.id)])
    .map(upgradeCardSession)
    .sort(
      (a, b) =>
        String(b.updatedAt).localeCompare(String(a.updatedAt)) ||
        a.id.localeCompare(b.id),
    );
}
export function cardSessionById(
  settings: Record<string, unknown>,
  id: string,
): CardSession | null {
  if (settings[closedSessionKey(id)]) return null;
  const session = settings[cardSessionKey(id)];
  if (validSession(session) && session.id === id)
    return upgradeCardSession(session);
  const legacy = settings.activeCardSession;
  return validSession(legacy) && legacy.id === id
    ? upgradeCardSession(legacy)
    : null;
}
export function activeCardSession(
  settings: Record<string, unknown>,
): CardSession | null {
  return savedCardSessions(settings)[0] ?? null;
}
// Adopt the existing single session lazily and without changing its ID, queue,
// ratings or history. The legacy field remains a compatible recent-session hint.
export function storeCardSession(
  settings: AppState["settings"],
  session: CardSession,
  activate = false,
): AppState["settings"] {
  if (settings[closedSessionKey(session.id)]) return settings;
  const legacy = settings.activeCardSession;
  return {
    ...settings,
    ...(validSession(legacy) &&
    !settings[cardSessionKey(legacy.id)] &&
    !settings[closedSessionKey(legacy.id)]
      ? { [cardSessionKey(legacy.id)]: legacy }
      : {}),
    [cardSessionKey(session.id)]: session,
    ...(activate || !validSession(legacy) || legacy.id === session.id
      ? { activeCardSession: session }
      : {}),
  };
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
      ...(state.settings[cardSessionKey(id)]
        ? { [cardSessionKey(id)]: null }
        : {}),
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
  const session = cardSessionById(state.settings, id);
  // A delayed draft must not restore a closed session or overwrite a rating.
  if (!session || session.turn !== turn) return state;
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
    settings: storeCardSession(state.settings, {
      ...session,
      updatedAt: new Date(now).toISOString(),
      presentation: view,
      items: session.items
        .filter((i) => existing.has(i.id))
        .map((i) => (seen.has(i.id) ? { ...i, seen: true } : i)),
    }),
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
