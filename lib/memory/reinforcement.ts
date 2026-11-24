import { gradeIndex, type GradeIndex } from "./grades";
import type { Review } from "../study/legacy";
import type { CardSession, SessionItem } from "./session";

// A session policy, not an FSRS interval. Never lower the floor just because
// the remaining selection is small. A deliberate extra round can waive it.
export function failureGap(size: number, failures: number) {
  const first = Math.max(8, Math.min(16, Math.ceil(size / 5)));
  return first + (failures >= 2 ? 4 : 0);
}
export const automaticFailureLimit = 3;

// Freeze independent recall grades, so practising a card during this session
// cannot make it look historically easier. No grade is invented for new cards.
export function capturePriorities(
  session: CardSession,
  index: GradeIndex,
): CardSession {
  return {
    ...session,
    priorityBasis: "recall-at-start",
    items: session.items.map((item) => {
      const average = index.get(item.id)?.average;
      return average == null ? item : { ...item, priorityScore: average };
    }),
  };
}
export function restorePriorities(
  session: CardSession,
  reviews: Review[],
): CardSession {
  if (
    session.priorityBasis ||
    session.grading !== "scores-v1" ||
    session.format === "orthography"
  )
    return session;
  const started = Date.parse(session.createdAt);
  const ids = new Set(session.items.map((item) => item.id));
  const prior = reviews.filter(
    (r) =>
      ids.has(r.cardId) &&
      r.cardSessionId !== session.id &&
      Date.parse(r.reviewedAt) <= started,
  );
  return capturePriorities(session, gradeIndex(prior));
}

// Among eligible cards, compare the actual miss, the independent historical
// average, then repeated failures and waiting order. If there is no previous
// average, put unknown retention between documented difficulty and prior passes.
export function comparePending(a: SessionItem, b: SessionItem) {
  const tier = (average: number | undefined) =>
    average === undefined ? 1 : average < 5 ? 0 : 2;
  return (
    (a.lastScore ?? 11) - (b.lastScore ?? 11) ||
    tier(a.priorityScore) - tier(b.priorityScore) ||
    (a.priorityScore ?? 0) - (b.priorityScore ?? 0) ||
    b.failures - a.failures ||
    (a.lastStep ?? 0) - (b.lastStep ?? 0)
  );
}

export function nextScoredItem(
  s: CardSession,
  available: SessionItem[],
): SessionItem | undefined {
  const fresh = available.find((i) => i.status === "new");
  if (!available.some((i) => i.status === "reinforce")) return fresh;
  // One last *answered* turn per distinct card. Passing, viewing the queue,
  // reloading or changing the clock cannot advance this index. The kth newest
  // turn being later than a miss proves that k different answers intervene.
  const turns: number[] = [];
  let latestRepeat = -Infinity;
  for (const i of available) {
    if (!i.attempts) continue;
    turns.push(i.lastTurn);
    if (i.attempts > 1 || i.guidedPractice)
      latestRepeat = Math.max(latestRepeat, i.lastTurn);
  }
  turns.sort((a, b) => b - a);
  if (fresh && latestRepeat !== -Infinity && !(turns[2] > latestRepeat))
    return fresh;
  const trail = s.trail ?? [];
  let best: SessionItem | undefined;
  for (const item of available) {
    if (item.status !== "reinforce" || item.id === trail.at(-1)) continue;
    if (item.gap > 0) {
      if (item.guidedPractice && !item.attempts) {
        // The user explicitly requested first practice of a newly derived card.
        if (
          new Set(
            trail.slice(item.lastStep ?? 0).filter((id) => id !== item.id),
          ).size < item.gap
        )
          continue;
      } else {
        if (item.failures >= automaticFailureLimit) continue;
        // Old saved sessions have positive gaps of just 1–3. Honor an explicit
        // round (gap 0), but never grandfather those short automatic gaps.
        const gap = Math.max(
          item.gap,
          failureGap(s.items.length, item.failures),
        );
        if (!(turns[gap - 1] > item.lastTurn)) continue;
      }
    }
    if (!best || comparePending(item, best) < 0) best = item;
  }
  return best ?? fresh;
}
