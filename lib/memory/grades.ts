import type { Card, Rating, Review } from "../study/legacy";

// One first numeric evaluation per card and saved session. Reopening the same
// session on any device cannot add another contribution to the arithmetic mean.
export const scoreGroups = [
  {
    id: "failed",
    label: "Suspendida",
    range: "1–4",
    value: 2.5,
    rating: "again",
  },
  {
    id: "sufficient",
    label: "Suficiente",
    range: "5–6",
    value: 5.5,
    rating: "hard",
  },
  { id: "notable", label: "Notable", range: "7–8", value: 7.5, rating: "good" },
  {
    id: "outstanding",
    label: "Sobresaliente",
    range: "9–10",
    value: 9.5,
    rating: "easy",
  },
] as const;
export type ScoreGroup = (typeof scoreGroups)[number]["id"];
const scoreFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 2,
});
export const formatScore = (value: number | null | undefined) =>
  value == null ? "—" : scoreFormatter.format(value);
export function scoreGroup(value: number): ScoreGroup {
  return value < 5
    ? "failed"
    : value < 7
      ? "sufficient"
      : value < 9
        ? "notable"
        : "outstanding";
}
export type ScoreKind = "recall" | "reinforcement";
export interface GradeStats {
  average: number | null;
  latestRecall: number | null;
  latest: number | null;
  recallCount: number;
  recallIds: Set<string>;
  recallSessions: Set<string>;
  recallScores: number[];
  lastAttemptAt: number;
}
export type GradeIndex = Map<string, GradeStats>;
export interface GradeFilter {
  kind:
    | "all"
    | "failed"
    | "sufficient"
    | "notable"
    | "outstanding"
    | "range"
    | "unrated";
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
  Number.isFinite(score) &&
  score >= 1 &&
  score <= 10;
export function scoreRating(score: number): Rating {
  if (!validScore(score)) throw new Error("La nota debe estar entre 1 y 10.");
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
      recallSessions: new Set<string>(),
      recallScores: [],
      lastAttemptAt: -Infinity,
    };
    const at = Date.parse(r.reviewedAt);
    if (validScore(r.score)) {
      s.latest = r.score;
      // Recompute rather than trusting v15's elapsed-time classification. This
      // also repairs old first attempts incorrectly flagged as reinforcement.
      const hasSession =
        typeof r.cardSessionId === "string" && r.cardSessionId.length > 0;
      const first = hasSession
        ? !s.recallSessions.has(r.cardSessionId!)
        : r.scoreKind === "recall";
      if (hasSession) s.recallSessions.add(r.cardSessionId!);
      if (first) {
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
  sessionId: string,
): ScoreKind {
  return index.get(card.id)?.recallSessions.has(sessionId)
    ? "reinforcement"
    : "recall";
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
      ? `↑ +${formatScore(change)} desde el último recuerdo`
      : `↓ ${formatScore(change)} desde el último recuerdo`;
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
          (filter.kind === "range"
            ? value >= filter.min && value <= filter.max
            : scoreGroup(value) === filter.kind))
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
