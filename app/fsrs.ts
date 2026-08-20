export type FsrsRating = "again" | "hard" | "good" | "easy";

export type FsrsMemory = {
  stability: number;
  difficulty: number;
};

export type FsrsLikeCard = {
  dueAt: string;
  lastReviewedAt: string | null;
  repetitions: number;
  lapses: number;
  streak: number;
  reviewCount: number;
  successCount: number;
  intervalDays: number;
  ease: number;
  fsrsStability?: number;
  fsrsDifficulty?: number;
};

// FSRS-6 published default parameters (21 weights).
// Source model: open-spaced-repetition/awesome-fsrs, FSRS-6.
export const FSRS6_DEFAULT_WEIGHTS = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194,
  0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629,
  1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
] as const;

export const FSRS_REQUEST_RETENTION = 0.9;
const DAY_MS = 86_400_000;
const W = FSRS6_DEFAULT_WEIGHTS;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const grade = (rating: FsrsRating) => rating === "again" ? 1 : rating === "hard" ? 2 : rating === "good" ? 3 : 4;

function initialStability(g: number) {
  return Math.max(0.01, W[g - 1]);
}

function initialDifficulty(g: number) {
  return clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10);
}

function nextDifficulty(current: number, g: number) {
  const delta = -W[6] * (g - 3);
  const damped = current + delta * ((10 - current) / 9);
  const easyTarget = initialDifficulty(4);
  return clamp(W[7] * easyTarget + (1 - W[7]) * damped, 1, 10);
}

export function fsrsRetrievability(stability: number, elapsedDays: number) {
  if (!Number.isFinite(stability) || stability <= 0) return 0;
  const decay = W[20];
  const factor = Math.pow(0.9, -1 / decay) - 1;
  return clamp(Math.pow(1 + factor * Math.max(0, elapsedDays) / stability, -decay), 0, 1);
}

function nextIntervalDays(stability: number, retention = FSRS_REQUEST_RETENTION) {
  const decay = W[20];
  const factor = Math.pow(0.9, -1 / decay) - 1;
  const interval = stability / factor * (Math.pow(retention, -1 / decay) - 1);
  return clamp(Math.round(interval), 1, 36_500);
}

function sameDayStability(stability: number, g: number) {
  const multiplier = Math.exp(W[17] * (g - 3 + W[18])) * Math.pow(stability, -W[19]);
  const candidate = stability * multiplier;
  // Successful same-day reviews should not reduce stability.
  return g >= 2 ? Math.max(stability, candidate) : Math.max(0.01, candidate);
}

function recallStability(stability: number, difficulty: number, retrievability: number, g: number) {
  const hardPenalty = g === 2 ? W[15] : 1;
  const easyBonus = g === 4 ? W[16] : 1;
  const growth = Math.exp(W[8])
    * (11 - difficulty)
    * Math.pow(stability, -W[9])
    * (Math.exp(W[10] * (1 - retrievability)) - 1)
    * hardPenalty
    * easyBonus;
  return Math.max(0.01, stability * (1 + Math.max(0, growth)));
}

function lapseStability(stability: number, difficulty: number, retrievability: number) {
  return Math.max(
    0.01,
    W[11]
      * Math.pow(difficulty, -W[12])
      * (Math.pow(stability + 1, W[13]) - 1)
      * Math.exp(W[14] * (1 - retrievability)),
  );
}

export function fsrsPreview(card: FsrsLikeCard, rating: FsrsRating, now = new Date()) {
  const g = grade(rating);
  const stability = Number(card.fsrsStability ?? 0);
  const difficulty = Number(card.fsrsDifficulty ?? 0);
  const isNew = card.repetitions <= 0 || stability <= 0 || difficulty <= 0;

  if (isNew) {
    const nextStability = initialStability(g);
    const nextDifficultyValue = initialDifficulty(g);
    if (rating === "again") {
      return {
        dueAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
        intervalDays: 0,
        stability: nextStability,
        difficulty: nextDifficultyValue,
        retrievability: 1,
      };
    }
    const intervalDays = nextIntervalDays(nextStability);
    return {
      dueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
      intervalDays,
      stability: nextStability,
      difficulty: nextDifficultyValue,
      retrievability: 1,
    };
  }

  const last = card.lastReviewedAt ? new Date(card.lastReviewedAt).getTime() : now.getTime();
  const elapsedDays = Math.max(0, (now.getTime() - last) / DAY_MS);
  const retrievability = fsrsRetrievability(stability, elapsedDays);
  const nextDifficultyValue = nextDifficulty(difficulty, g);

  let nextStability: number;
  if (elapsedDays < 1) {
    nextStability = sameDayStability(stability, g);
  } else if (rating === "again") {
    nextStability = lapseStability(stability, nextDifficultyValue, retrievability);
  } else {
    nextStability = recallStability(stability, nextDifficultyValue, retrievability, g);
  }

  if (rating === "again") {
    return {
      dueAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
      intervalDays: 0,
      stability: nextStability,
      difficulty: nextDifficultyValue,
      retrievability,
    };
  }

  const intervalDays = nextIntervalDays(nextStability);
  return {
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
    intervalDays,
    stability: nextStability,
    difficulty: nextDifficultyValue,
    retrievability,
  };
}

export function applyFsrsReview<T extends FsrsLikeCard>(card: T, rating: FsrsRating, now = new Date()): T {
  const preview = fsrsPreview(card, rating, now);
  const success = rating !== "again";
  return {
    ...card,
    dueAt: preview.dueAt,
    lastReviewedAt: now.toISOString(),
    intervalDays: preview.intervalDays,
    // Keep ease for backward compatibility with the old storage/UI, but it now mirrors FSRS difficulty.
    ease: preview.difficulty,
    fsrsStability: preview.stability,
    fsrsDifficulty: preview.difficulty,
    repetitions: card.repetitions + 1,
    lapses: card.lapses + (rating === "again" ? 1 : 0),
    streak: success ? card.streak + 1 : 0,
    reviewCount: card.reviewCount + 1,
    successCount: card.successCount + (success ? 1 : 0),
  };
}

export function fsrsDueLabel(card: FsrsLikeCard, rating: FsrsRating) {
  const result = fsrsPreview(card, rating);
  if (rating === "again") return "10 min";
  if (result.intervalDays <= 1) return "1 d";
  return `${result.intervalDays} d`;
}
