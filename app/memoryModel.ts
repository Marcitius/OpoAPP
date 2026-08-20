import { applyFsrsReview, fsrsCurrentRetrievability, type FsrsLikeCard, type FsrsRating } from "./fsrs";

export type PersonalMemoryCard = FsrsLikeCard & {
  id: string;
  createdAt: string;
};

export type PersonalMemoryReview = {
  cardId: string;
  rating: FsrsRating;
  correct: boolean;
  reviewedAt: string;
  responseMs?: number;
};

export type PersonalMemoryModel = {
  samples: number;
  weights: number[];
  influence: number;
  status: "collecting" | "calibrating" | "active";
};

const DEFAULT_WEIGHTS = [0, 1, 0, 0, 0, 0] as const;
const MIN_TRAINING_SAMPLES = 40;
const FULL_INFLUENCE_SAMPLES = 300;
const MAX_MODEL_INFLUENCE = 0.45;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const sigmoid = (value: number) => 1 / (1 + Math.exp(-clamp(value, -20, 20)));
const logit = (probability: number) => {
  const p = clamp(probability, 0.03, 0.97);
  return Math.log(p / (1 - p));
};

function dot(weights: number[], features: number[]) {
  return weights.reduce((sum, weight, index) => sum + weight * (features[index] ?? 0), 0);
}

function makeReplayCard(card: PersonalMemoryCard): PersonalMemoryCard {
  return {
    ...card,
    dueAt: card.createdAt,
    lastReviewedAt: null,
    intervalDays: 0,
    ease: 0,
    repetitions: 0,
    lapses: 0,
    streak: 0,
    reviewCount: 0,
    successCount: 0,
    fsrsStability: 0,
    fsrsDifficulty: 0,
  };
}

function featuresFor(
  card: FsrsLikeCard,
  retrievability: number,
  priorHardRate: number,
  averageResponseMs: number,
) {
  const difficulty = Number(card.fsrsDifficulty ?? 0);
  const lapseRate = card.repetitions > 0 ? card.lapses / card.repetitions : 0;
  const slowRecall = averageResponseMs > 0
    ? clamp(Math.log1p(averageResponseMs / 1000) / Math.log(31), 0, 1)
    : 0;

  return [
    1,
    logit(retrievability),
    difficulty > 0 ? (difficulty - 5) / 5 : 0,
    clamp(lapseRate, 0, 1),
    clamp(priorHardRate, 0, 1),
    slowRecall,
  ];
}

export function fitPersonalMemoryModel(cards: PersonalMemoryCard[], reviews: PersonalMemoryReview[]): PersonalMemoryModel {
  const cardMap = new Map(cards.map((card) => [card.id, card]));
  const reviewsByCard = new Map<string, PersonalMemoryReview[]>();

  for (const review of reviews) {
    if (!cardMap.has(review.cardId)) continue;
    const list = reviewsByCard.get(review.cardId) ?? [];
    list.push(review);
    reviewsByCard.set(review.cardId, list);
  }

  const samples: Array<{ x: number[]; y: number }> = [];

  for (const [cardId, cardReviews] of reviewsByCard) {
    const source = cardMap.get(cardId);
    if (!source) continue;

    let replay = makeReplayCard(source);
    let hardCount = 0;
    let responseTotal = 0;
    let responseCount = 0;
    let priorReviews = 0;

    for (const review of [...cardReviews].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt))) {
      const reviewedAt = new Date(review.reviewedAt);
      if (Number.isNaN(reviewedAt.getTime())) continue;

      const retrievability = fsrsCurrentRetrievability(replay, reviewedAt);
      const hardRate = priorReviews > 0 ? hardCount / priorReviews : 0;
      const averageResponseMs = responseCount > 0 ? responseTotal / responseCount : 0;
      samples.push({
        x: featuresFor(replay, retrievability, hardRate, averageResponseMs),
        y: review.correct ? 1 : 0,
      });

      replay = applyFsrsReview(replay, review.rating, reviewedAt);
      priorReviews += 1;
      if (review.rating === "hard") hardCount += 1;
      if (Number(review.responseMs ?? 0) > 0) {
        responseTotal += Number(review.responseMs);
        responseCount += 1;
      }
    }
  }

  if (samples.length < MIN_TRAINING_SAMPLES) {
    return {
      samples: samples.length,
      weights: [...DEFAULT_WEIGHTS],
      influence: 0,
      status: "collecting",
    };
  }

  const weights = [...DEFAULT_WEIGHTS];
  const anchors = [...DEFAULT_WEIGHTS];
  const lambda = 0.018;
  const trainingSamples = samples.length > 2500 ? samples.slice(-2500) : samples;

  for (let epoch = 0; epoch < 75; epoch += 1) {
    const learningRate = 0.035 / (1 + epoch * 0.025);
    for (const sample of trainingSamples) {
      const prediction = sigmoid(dot(weights, sample.x));
      const error = prediction - sample.y;
      for (let index = 0; index < weights.length; index += 1) {
        const regularization = lambda * (weights[index] - anchors[index]);
        weights[index] -= learningRate * (error * sample.x[index] + regularization);
      }
    }
  }

  const progress = clamp(
    (samples.length - MIN_TRAINING_SAMPLES) / (FULL_INFLUENCE_SAMPLES - MIN_TRAINING_SAMPLES),
    0,
    1,
  );
  const influence = 0.12 + progress * (MAX_MODEL_INFLUENCE - 0.12);

  return {
    samples: samples.length,
    weights,
    influence,
    status: samples.length >= FULL_INFLUENCE_SAMPLES ? "active" : "calibrating",
  };
}

export function predictPersonalRecall(
  card: PersonalMemoryCard,
  reviews: PersonalMemoryReview[],
  model: PersonalMemoryModel,
  now = new Date(),
) {
  if (card.reviewCount <= 0) {
    return { probability: 0.5, fsrsProbability: 0.5, modelProbability: 0.5 };
  }

  const cardReviews = reviews.filter((review) => review.cardId === card.id);
  const hardCount = cardReviews.filter((review) => review.rating === "hard").length;
  const hardRate = cardReviews.length ? hardCount / cardReviews.length : 0;
  const timed = cardReviews.map((review) => Number(review.responseMs ?? 0)).filter((value) => value > 0);
  const averageResponseMs = timed.length ? timed.reduce((sum, value) => sum + value, 0) / timed.length : 0;

  const fsrsProbability = fsrsCurrentRetrievability(card, now);
  const modelProbability = sigmoid(dot(model.weights, featuresFor(card, fsrsProbability, hardRate, averageResponseMs)));

  // Conservative blend: FSRS remains the anchor until enough personal data exists.
  let probability = fsrsProbability * (1 - model.influence) + modelProbability * model.influence;

  // Per-card Bayesian evidence starts helping immediately, even before the global model activates.
  const empiricalProbability = (card.successCount + 4.5) / (card.reviewCount + 5);
  const cardEvidenceWeight = Math.min(0.22, card.reviewCount / 12 * 0.22);
  probability = probability * (1 - cardEvidenceWeight) + empiricalProbability * cardEvidenceWeight;

  return {
    probability: clamp(probability, 0.01, 0.99),
    fsrsProbability,
    modelProbability,
  };
}

export function personalModelLabel(model: PersonalMemoryModel) {
  if (model.status === "collecting") return `Modelo personal · aprendiendo ${model.samples}/${MIN_TRAINING_SAMPLES}`;
  if (model.status === "calibrating") return `Modelo personal · calibrando ${model.samples} repasos`;
  return `Modelo personal activo · ${model.samples} repasos`;
}
