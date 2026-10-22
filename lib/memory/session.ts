import { legacyNextSessionCard, legacyAnswerSession } from "./orthographyQueue";
import type {
  Card,
  Rating,
  StudyMode,
  ReviewQueueItem,
  WrittenAnswerResult,
  OrthographySessionState,
} from "../study/legacy";

export interface SessionItem {
  id: string;
  attempts: number;
  failures: number;
  remembered: number;
  lastRating?: Rating;
  lastTurn: number;
  eligibleAt: number;
  gap: number;
  seen?: boolean;
  lastStep?: number;
  status: "new" | "reinforce" | "remembered" | "weak" | "skipped";
}
export interface SessionPresentation {
  queue: ReviewQueueItem[];
  index: number;
  revealed: boolean;
  selectedOption: number | null;
  selectedOptions: number[];
  writtenAnswer: string;
  writtenResult: WrittenAnswerResult | null;
  orthography: OrthographySessionState | null;
  orthographySelected: string[];
}
export interface CardSession {
  version: 1;
  id: string;
  mode: StudyMode;
  algorithmVersion?: 2;
  label?: string;
  trail?: string[];
  lastReinforcementStep?: number;
  presentation?: SessionPresentation;
  createdAt: string;
  updatedAt: string;
  turn: number;
  lastId?: string;
  items: SessionItem[];
  history: { cardId: string; rating: Rating; reviewId: string }[];
  studyTaskId?: string;
  sourceNodeId?: string;
  sourceCollectionId?: string;
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
    algorithmVersion: 2,
    trail: [],
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
    seen: session.items.filter(
      (i) => i.seen || i.attempts > 0 || i.status === "skipped",
    ).length,
    remembered: session.items.filter((i) => i.status === "remembered").length,
    weak: session.items.filter(
      (i) => i.status === "weak" || i.status === "reinforce",
    ).length,
    skipped: session.items.filter((i) => i.status === "skipped").length,
    responses: session.history.length,
  };
}
// Session spacing is measured in distinct other cards, independently of FSRS dates.
// At most one reinforcement per three first presentations while unseen cards remain.
export function nextSessionCard(
  session: CardSession,
  cards: Card[],
  now: number,
):
  | { kind: "card"; id: string }
  | { kind: "waiting"; readyAt: number }
  | { kind: "complete" } {
  if (session.format === "orthography")
    return legacyNextSessionCard(session, cards, now);
  const s = upgradeCardSession(session);
  const existing = new Set(cards.map((c) => c.id));
  const available = s.items.filter((i) => existing.has(i.id));
  const fresh = available.filter((i) => i.status === "new");
  const trail = s.trail ?? [];
  const repeat = available
    .filter((i) => {
      if (i.status !== "reinforce" || i.id === trail.at(-1)) return false;
      const others = new Set(
        trail.slice(i.lastStep ?? 0).filter((id) => id !== i.id),
      );
      return others.size >= i.gap;
    })
    .sort(
      (a, b) =>
        (a.lastStep ?? 0) - (b.lastStep ?? 0) ||
        s.items.indexOf(a) - s.items.indexOf(b),
    );
  const enoughFresh =
    s.lastReinforcementStep === undefined ||
    trail.length - s.lastReinforcementStep >= 3;
  const chosen =
    fresh.length && (!repeat.length || !enoughFresh)
      ? fresh[0]
      : (repeat[0] ?? fresh[0]);
  // If separation cannot be achieved, leave weak items for a later review rather
  // than returning the same card because the user paused or ran out of cards.
  return chosen ? { kind: "card", id: chosen.id } : { kind: "complete" };
}
export function answerSession(
  session: CardSession,
  card: Card,
  rating: Rating,
  reviewId: string,
  now: number,
): CardSession {
  if (session.history.some((r) => r.reviewId === reviewId)) return session;
  if (session.format === "orthography")
    return legacyAnswerSession(session, card, rating, reviewId, now);
  const s = upgradeCardSession(session),
    item = s.items.find((i) => i.id === card.id);
  if (!item || !["new", "reinforce"].includes(item.status)) return session;
  const attempts = item.attempts + 1;
  const remembered = rating === "good" || rating === "easy";
  const status: SessionItem["status"] = remembered
    ? "remembered"
    : (rating === "hard" ? attempts >= 2 : attempts >= 3)
      ? "weak"
      : "reinforce";
  const trail = [...(s.trail ?? []), card.id];
  const presentation = s.presentation
    ? {
        ...s.presentation,
        queue: s.presentation.queue.map((q, index) =>
          index === s.presentation!.index && q.cardId === card.id
            ? { ...q, completed: true }
            : q,
        ),
      }
    : undefined;
  return {
    ...s,
    turn: s.turn + 1,
    lastId: card.id,
    trail,
    ...(presentation ? { presentation } : {}),
    ...(item.attempts > 0 ? { lastReinforcementStep: trail.length } : {}),
    updatedAt: new Date(now).toISOString(),
    history: [...s.history, { cardId: card.id, rating, reviewId }],
    items: s.items.map((i) =>
      i.id === card.id
        ? {
            ...i,
            attempts,
            seen: true,
            failures: i.failures + Number(rating === "again"),
            remembered: i.remembered + Number(remembered),
            lastRating: rating,
            lastTurn: s.turn + 1,
            lastStep: trail.length,
            eligibleAt: now,
            gap: Math.min(8, Math.max(1, s.items.length - 1)),
            status,
          }
        : i,
    ),
  };
}
// Old checkpoints are adopted without touching their cards or review history.
export function upgradeCardSession(session: CardSession): CardSession {
  if (session.algorithmVersion === 2 || session.format === "orthography")
    return session;
  const trail = session.history.map((r) => r.cardId);
  return {
    ...session,
    algorithmVersion: 2,
    trail,
    items: session.items.map((i) => {
      const last =
        session.history.filter((r) => r.cardId === i.id).at(-1)?.rating ??
        i.lastRating;
      const status =
        i.status === "skipped"
          ? i.status
          : last === "good" || last === "easy"
            ? "remembered"
            : (last === "hard" && i.attempts >= 2) ||
                (last === "again" && i.attempts >= 3)
              ? "weak"
              : i.status;
      return {
        ...i,
        status,
        seen: i.attempts > 0 || i.status === "skipped",
        lastStep: trail.lastIndexOf(i.id) + 1,
        gap: Math.min(8, Math.max(1, session.items.length - 1)),
      };
    }),
  };
}
// Existing modes, with interleaving only for the recommended queue.
export function interleaveNewCards(cards: Card[]): Card[] {
  const due = cards.filter((c) => c.reviewCount > 0),
    fresh = cards.filter((c) => !c.reviewCount);
  const mixed: Card[] = [];
  while (due.length || fresh.length) {
    mixed.push(...due.splice(0, 2), ...fresh.splice(0, 1));
  }
  return mixed;
}
export function skipSessionCard(
  session: CardSession,
  id: string,
  now: number,
): CardSession {
  const ordinary = session.format !== "orthography";
  return {
    ...session,
    ...(ordinary ? { turn: session.turn + 1 } : {}),
    ...(ordinary
      ? {
          trail: [
            ...(session.trail ?? session.history.map((r) => r.cardId)),
            id,
          ],
        }
      : {}),
    lastId: id,
    updatedAt: new Date(now).toISOString(),
    items: session.items.map((i) =>
      i.id === id ? { ...i, seen: true, status: "skipped" } : i,
    ),
  };
}
