import {
  fsrs,
  createEmptyCard,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
} from "ts-fsrs";
const scheduler = fsrs({
  request_retention: 0.9,
  enable_fuzz: false,
  enable_short_term: true,
});
type RatingName = "again" | "hard" | "good" | "easy";
const grades: Record<RatingName, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};
interface Progress {
  dueAt: string;
  lastReviewedAt: string | null;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  reviewCount: number;
  successCount: number;
  streak: number;
  fsrsStability: number;
  fsrsDifficulty: number;
}
function input(c: Progress, now = new Date()): FsrsCard {
  const original = createEmptyCard(now);
  return {
    ...original,
    due: new Date(c.dueAt),
    last_review: c.lastReviewedAt ? new Date(c.lastReviewedAt) : undefined,
    stability: c.fsrsStability || Math.max(0.1, c.intervalDays),
    difficulty: c.fsrsDifficulty || 5,
    reps: c.reviewCount,
    lapses: c.lapses,
    scheduled_days: c.intervalDays,
    state: c.reviewCount ? State.Review : State.New,
  };
}
export function applyFsrsReview<T extends Progress>(
  c: T,
  rating: RatingName,
  now = new Date(),
): T {
  const { card } = scheduler.next(input(c, now), now, grades[rating]);
  const success = rating !== "again";
  return {
    ...c,
    dueAt: card.due.toISOString(),
    lastReviewedAt: now.toISOString(),
    intervalDays: card.scheduled_days,
    repetitions: c.repetitions + 1,
    lapses: card.lapses,
    reviewCount: c.reviewCount + 1,
    successCount: c.successCount + Number(success),
    streak: success ? c.streak + 1 : 0,
    fsrsStability: card.stability,
    fsrsDifficulty: card.difficulty,
  };
}
export function fsrsCurrentRetrievability(c: Progress, now = new Date()) {
  if (!c.lastReviewedAt || !c.fsrsStability) return c.reviewCount ? 0.5 : 0;
  return Number(scheduler.get_retrievability(input(c, now), now, false));
}
export function fsrsDueLabel(c: Progress, rating: RatingName) {
  const next = applyFsrsReview(c, rating);
  const minutes = Math.max(
    1,
    Math.round((Date.parse(next.dueAt) - Date.now()) / 60000),
  );
  return minutes < 60
    ? `${minutes} min`
    : minutes < 1440
      ? `${Math.round(minutes / 60)} h`
      : `${Math.round(minutes / 1440)} días`;
}
