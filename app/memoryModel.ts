import { fsrsCurrentRetrievability } from "./fsrs";
interface Model {
  samples: number;
  calibration: number;
}
export function fitPersonalMemoryModel(cards: any[], reviews: any[]): Model {
  const eligible = reviews
    .filter(
      (r) =>
        Number.isFinite(r.predictedRecall) &&
        r.predictedRecall >= 0 &&
        r.predictedRecall <= 1 &&
        !r.reinforcement,
    )
    .sort((a, b) => String(a.reviewedAt).localeCompare(String(b.reviewedAt)))
    .slice(-500);
  if (eligible.length < 30) return { samples: eligible.length, calibration: 1 };
  const observed =
      (eligible.filter((r) => r.correct).length + 2) / (eligible.length + 4),
    predicted =
      eligible.reduce((s, r) => s + r.predictedRecall, 0) / eligible.length;
  return {
    samples: eligible.length,
    // Shrink noisy history toward the existing FSRS prediction. This only
    // prioritizes the queue; it does not pretend to train FSRS parameters.
    calibration:
      1 +
      Math.min(1, eligible.length / 200) *
        (Math.min(1.25, Math.max(0.75, observed / Math.max(0.1, predicted))) -
          1),
  };
}
export function predictPersonalRecall(
  card: any,
  reviews: any[],
  model: Model,
  now = new Date(),
) {
  return {
    probability: Math.max(
      0,
      Math.min(1, fsrsCurrentRetrievability(card, now) * model.calibration),
    ),
  };
}
export function personalModelLabel(model: Model) {
  return model.samples >= 30
    ? "FSRS · ajuste personal"
    : "FSRS · aprendiendo de tus respuestas";
}
