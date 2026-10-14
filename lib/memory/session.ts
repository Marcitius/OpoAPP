import { State } from "ts-fsrs";
import { hardPracticeDelay, isLearning } from "../../app/fsrs";
import type { Card, Rating, StudyMode } from "../study/legacy";

export interface SessionItem {
  id: string;
  attempts: number;
  failures: number;
  remembered: number;
  lastRating?: Rating;
  lastTurn: number;
  eligibleAt: number;
  gap: number;
  status: "new" | "reinforce" | "remembered" | "weak" | "skipped";
}
export interface CardSession {
  version: 1;
  id: string;
  mode: StudyMode;
  createdAt: string;
  updatedAt: string;
  turn: number;
  lastId?: string;
  items: SessionItem[];
  history: { cardId: string; rating: Rating; reviewId: string }[];
  studyTaskId?: string;
  sourceNodeId?: string;
  format?: "orthography";
}
export function createCardSession(
  cards: Card[],
  mode: StudyMode,
  id: string,
  now: number,
): CardSession {
  const seen = new Set<string>();
  return {
    version: 1,
    id,
    mode,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    turn: 0,
    history: [],
    items: cards
      .filter((c) => !seen.has(c.id) && !!seen.add(c.id))
      .map((c) => ({
        id: c.id,
        attempts: 0,
        failures: 0,
        remembered: 0,
        lastTurn: -100,
        eligibleAt: now,
        gap: 0,
        status: "new",
      })),
  };
}
export function validSession(value: unknown): value is CardSession {
  const s = value as CardSession;
  return (
    !!s &&
    s.version === 1 &&
    typeof s.id === "string" &&
    Number.isFinite(s.turn) &&
    Array.isArray(s.history) &&
    Array.isArray(s.items) &&
    s.items.every(
      (i) =>
        typeof i.id === "string" &&
        Number.isFinite(i.attempts) &&
        Number.isFinite(i.eligibleAt) &&
        ["new", "reinforce", "remembered", "weak", "skipped"].includes(
          i.status,
        ),
    )
  );
}
export function sessionSummary(session: CardSession) {
  return {
    total: session.items.length,
    seen: session.items.filter((i) => i.attempts > 0).length,
    remembered: session.items.filter((i) => i.status === "remembered").length,
    weak: session.items.filter(
      (i) => i.status === "weak" || i.status === "reinforce",
    ).length,
    skipped: session.items.filter((i) => i.status === "skipped").length,
    responses: session.history.length,
  };
}
export function nextSessionCard(
  session: CardSession,
  cards: Card[],
  now: number,
):
  | { kind: "card"; id: string }
  | { kind: "waiting"; readyAt: number }
  | { kind: "complete" } {
  const available = session.items.filter(
    (i) =>
      (i.status === "new" || i.status === "reinforce") &&
      cards.some((c) => c.id === i.id),
  );
  if (!available.length) return { kind: "complete" };
  const timeReady = available.filter((i) => i.eligibleAt <= now);
  let ready = timeReady.filter(
    (i) =>
      session.turn - i.lastTurn >= i.gap ||
      !available.some((other) => other.id !== i.id),
  );
  if (!ready.length && available.every((i) => i.status !== "new"))
    ready = timeReady;
  const separated = ready.filter((i) => i.id !== session.lastId);
  const pool = separated.length ? separated : ready;
  if (pool.length) {
    // Due reinforcement first, but use unseen cards to create real separation.
    pool.sort(
      (a, b) =>
        Number(a.status !== "reinforce") - Number(b.status !== "reinforce") ||
        a.eligibleAt - b.eligibleAt ||
        session.items.indexOf(a) - session.items.indexOf(b),
    );
    return { kind: "card", id: pool[0].id };
  }
  // If every remaining item is cooling down, time still prevents an immediate
  // consecutive repeat. The turn condition is relaxed only after its due time.
  return {
    kind: "waiting",
    readyAt: Math.max(now + 1, Math.min(...available.map((i) => i.eligibleAt))),
  };
}
export function answerSession(
  session: CardSession,
  card: Card,
  rating: Rating,
  reviewId: string,
  now: number,
): CardSession {
  const item = session.items.find((i) => i.id === card.id);
  if (!item) return session;
  const turn = session.turn + 1,
    attempts = item.attempts + 1;
  const weak = rating === "again" || rating === "hard" || isLearning(card);
  let status: SessionItem["status"] = weak ? "reinforce" : "remembered";
  // A finite session should not drill one stubborn card indefinitely. Its FSRS
  // due/state remain intact, and the summary explicitly calls it weak.
  if (weak && attempts >= 6) status = "weak";
  const due = Date.parse(card.dueAt);
  const eligibleAt =
    rating === "hard" && card.fsrsState === State.Review
      ? now + hardPracticeDelay(new Date(now))
      : Number.isFinite(due)
        ? due
        : now + 60_000;
  return {
    ...session,
    turn,
    lastId: card.id,
    updatedAt: new Date(now).toISOString(),
    history: [...session.history, { cardId: card.id, rating, reviewId }],
    items: session.items.map((i) =>
      i.id === card.id
        ? {
            ...i,
            attempts,
            failures: i.failures + Number(rating === "again"),
            remembered:
              i.remembered + Number(rating === "good" || rating === "easy"),
            lastRating: rating,
            lastTurn: turn,
            eligibleAt,
            gap: rating === "again" ? 2 : 3,
            status,
          }
        : i,
    ),
  };
}
export function skipSessionCard(
  session: CardSession,
  id: string,
  now: number,
): CardSession {
  return {
    ...session,
    lastId: id,
    updatedAt: new Date(now).toISOString(),
    items: session.items.map((i) =>
      i.id === id ? { ...i, status: "skipped" } : i,
    ),
  };
}
