export default function ScorePicker({
  onScore,
  disabled,
  incorrect,
  hint,
}: {
  onScore: (score: number) => void;
  disabled?: boolean;
  incorrect?: boolean;
  hint: string;
}) {
  return (
    <>
      <p className="rating-prompt">¿Qué nota le das a tu recuerdo?</p>
      <div
        className="review-rating-buttons score-buttons"
        role="group"
        aria-label="Nota del 1 al 10"
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
          <button
            key={score}
            aria-label={`Nota ${score}`}
            className={
              score < 5
                ? "again"
                : score < 7
                  ? "hard"
                  : score < 9
                    ? "good"
                    : "easy"
            }
            disabled={disabled || (incorrect && score >= 5)}
            onClick={() => onScore(score)}
          >
            <strong>{score}</strong>
          </button>
        ))}
      </div>
      <small className="score-help">
        1–4: vuelve después · 5–10: terminada en esta sesión
      </small>
      {incorrect && (
        <small className="score-help">
          La respuesta del test es incorrecta. Valora del 1 al 4.
        </small>
      )}
      <small className="score-help">{hint}</small>
    </>
  );
}
