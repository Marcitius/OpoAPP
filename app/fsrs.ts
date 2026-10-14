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
export type RatingName = "again" | "hard" | "good" | "easy";
const grades: Record<RatingName, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};
export interface Progress {
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
  fsrsState?: State;
  fsrsLearningSteps?: number;
  fsrsReps?: number;
}
export function fsrsInput(c: Progress, now = new Date()): FsrsCard {
  const original = createEmptyCard(now);
  // Legacy cards retain their memory values. Missing metadata is adopted lazily,
  // never by resetting cards or replaying old practice logs as new responses.
  const hasReview = c.reviewCount > 0 || (c.fsrsReps ?? 0) > 0;
  const state = c.fsrsState ?? (hasReview ? State.Review : State.New);
  return {
    ...original,
    due: Number.isFinite(Date.parse(c.dueAt)) ? new Date(c.dueAt) : now,
    last_review: c.lastReviewedAt ? new Date(c.lastReviewedAt) : undefined,
    stability: hasReview ? c.fsrsStability || Math.max(0.1, c.intervalDays) : 0,
    difficulty: hasReview ? c.fsrsDifficulty || 5 : 0,
    reps: c.fsrsReps ?? c.reviewCount,
    lapses: c.lapses,
    scheduled_days: c.intervalDays,
    state,
    learning_steps: c.fsrsLearningSteps ?? 0,
  };
}
export function applyFsrsReview<T extends Progress>(
  c: T,
  rating: RatingName,
  now = new Date(),
  reinforcement = false,
): T {
  const { card } = scheduler.next(fsrsInput(c, now), now, grades[rating]);
  const success = rating !== "again";
  return {
    ...c,
    dueAt: card.due.toISOString(),
    lastReviewedAt: now.toISOString(),
    intervalDays: card.scheduled_days,
    repetitions: c.repetitions + 1,
    lapses: card.lapses,
    // Keep the existing first-encounter counters comparable. FSRS itself sees
    // every genuine attempt, including same-day reinforcement.
    reviewCount: c.reviewCount + Number(!reinforcement),
    successCount: c.successCount + Number(success && !reinforcement),
    streak: success ? c.streak + 1 : 0,
    fsrsStability: card.stability,
    fsrsDifficulty: card.difficulty,
    fsrsState: card.state,
    fsrsLearningSteps: card.learning_steps,
    fsrsReps: card.reps,
  };
}
export function fsrsCurrentRetrievability(c: Progress, now = new Date()) {
  if (!c.lastReviewedAt || !c.fsrsStability) return c.reviewCount ? 0.5 : 0;
  return Number(scheduler.get_retrievability(fsrsInput(c, now), now, false));
}
export function fsrsSnapshot(c: Progress) {
  return {
    state: c.fsrsState ?? (c.reviewCount ? State.Review : State.New),
    learningSteps: c.fsrsLearningSteps ?? 0,
    reps: c.fsrsReps ?? c.reviewCount,
    stability: c.fsrsStability,
    difficulty: c.fsrsDifficulty,
    dueAt: c.dueAt,
    lastReviewedAt: c.lastReviewedAt,
    lapses: c.lapses,
  };
}
export function isLearning(c: Progress) {
  return c.fsrsState === State.Learning || c.fsrsState === State.Relearning;
}
// A hard-but-correct mature card gets one spaced confirmation in the session.
// This uses the library's learning-step duration, not an invented day interval.
export function hardPracticeDelay(now = new Date()) {
  return (
    scheduler.next(createEmptyCard(now), now, Rating.Hard).card.due.getTime() -
    now.getTime()
  );
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
