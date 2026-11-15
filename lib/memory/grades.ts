import type { Card, Rating, Review } from "../study/legacy";

// Product rule for evidence, not an FSRS interval: a new session, midnight or
// another device never makes immediate practice an independent recall test.
export const RECALL_BREAK_MS = 12 * 60 * 60 * 1000;
export type ScoreKind = "recall" | "reinforcement";
export interface GradeStats {
  average: number | null;
  latestRecall: number | null;
  latest: number | null;
  recallCount: number;
  recallIds: Set<string>;
  recallScores: number[];
  lastAttemptAt: number;
}
export type GradeIndex = Map<string, GradeStats>;
export interface GradeFilter {
  kind: "all" | "failed" | "range" | "unrated";
  metric: "average" | "latest";
  min: number;
  max: number;
}
export const defaultGradeFilter: GradeFilter = {
  kind: "all",
  metric: "average",
  min: 1,
  max: 10,
};
export const validScore = (score: unknown): score is number =>
  typeof score === "number" &&
  Number.isInteger(score) &&
  score >= 1 &&
  score <= 10;
export function scoreRating(score: number): Rating {
  if (!validScore(score))
    throw new Error("La nota debe ser un entero del 1 al 10.");
  return score < 5 ? "again" : score < 7 ? "hard" : score < 9 ? "good" : "easy";
}
export function uniqueReviews(reviews: Review[]) {
  const seen = new Set<string>();
  return [...reviews]
    .filter(
      (r) =>
        !seen.has(r.id) &&
        !!seen.add(r.id) &&
        Number.isFinite(Date.parse(r.reviewedAt)),
    )
    .sort(
      (a, b) =>
        Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt) ||
        a.id.localeCompare(b.id),
    );
}
export function gradeIndex(reviews: Review[]): GradeIndex {
  const result: GradeIndex = new Map();
  for (const r of uniqueReviews(reviews)) {
    const s = result.get(r.cardId) ?? {
      average: null,
      latestRecall: null,
      latest: null,
      recallCount: 0,
      recallIds: new Set<string>(),
      recallScores: [],
      lastAttemptAt: -Infinity,
    };
    const at = Date.parse(r.reviewedAt);
    if (validScore(r.score)) {
      s.latest = r.score;
      // Recompute from immutable events: simultaneous offline first attempts
      // cannot contribute twice to the mean after the devices synchronize.
      if (r.scoreKind === "recall" && at - s.lastAttemptAt >= RECALL_BREAK_MS) {
        s.recallScores.push(r.score);
        s.recallIds.add(r.id);
        s.recallCount++;
        s.latestRecall = r.score;
        s.average = s.recallScores.reduce((a, b) => a + b, 0) / s.recallCount;
      }
    }
    s.lastAttemptAt = Math.max(s.lastAttemptAt, at);
    result.set(r.cardId, s);
  }
  return result;
}
export function scoreKind(
  card: Card,
  index: GradeIndex,
  now: number,
): ScoreKind {
  const last = Math.max(
    index.get(card.id)?.lastAttemptAt ?? -Infinity,
    card.lastReviewedAt
      ? Date.parse(card.lastReviewedAt) || -Infinity
      : -Infinity,
  );
  return now - last >= RECALL_BREAK_MS ? "recall" : "reinforcement";
}
export function gradeValue(
  index: GradeIndex,
  id: string,
  metric: GradeFilter["metric"],
) {
  const stats = index.get(id);
  return (metric === "latest" ? stats?.latestRecall : stats?.average) ?? null;
}
export function recallTrend(index: GradeIndex, id: string) {
  const scores = index.get(id)?.recallScores;
  if (!scores || scores.length < 2) return "";
  const change = scores.at(-1)! - scores.at(-2)!;
  return change === 0
    ? "sin cambio"
    : change > 0
      ? `↑ +${change} desde el último recuerdo`
      : `↓ ${change} desde el último recuerdo`;
}
export function filterByGrade(
  cards: Card[],
  index: GradeIndex,
  filter: GradeFilter,
) {
  return cards.filter((c) => {
    if (c.type === "orthography") return filter.kind === "all";
    const value = gradeValue(index, c.id, filter.metric);
    return (
      filter.kind === "all" ||
      (filter.kind === "unrated"
        ? value === null
        : value !== null &&
          (filter.kind === "failed"
            ? value < 5
            : value >= filter.min && value <= filter.max))
    );
  });
}
export function orderByGrade(
  cards: Card[],
  index: GradeIndex,
  metric: GradeFilter["metric"] = "average",
) {
  const rated = cards
    .filter((c) => gradeValue(index, c.id, metric) !== null)
    .sort(
      (a, b) =>
        gradeValue(index, a.id, metric)! - gradeValue(index, b.id, metric)!,
    );
  const fresh = cards.filter((c) => gradeValue(index, c.id, metric) === null);
  const mixed: Card[] = [];
  // Unrated is not a zero. Reserve a turn for it rather than starving it.
  while (rated.length || fresh.length)
    mixed.push(...rated.splice(0, 2), ...fresh.splice(0, 1));
  return mixed;
}
