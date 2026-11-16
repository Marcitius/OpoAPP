import { scoreGroups } from "../../lib/memory/grades";
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
      <p className="rating-prompt">¿Cómo la llevas?</p>
      <div
        className="review-rating-buttons score-buttons"
        role="group"
        aria-label="Valoración del recuerdo"
      >
        {scoreGroups.map((group) => (
          <button
            key={group.id}
            aria-label={group.label}
            className={group.rating}
            title={`Aporta ${group.value.toLocaleString("es-ES")} a la media en el primer intento de esta sesión`}
            disabled={disabled || (incorrect && group.value >= 5)}
            onClick={() => onScore(group.value)}
          >
            <strong>{group.label}</strong>
            <small>{group.range}</small>
          </button>
        ))}
      </div>
      <small className="score-help">
        Suspendida: vuelve después · Aprobada: terminada en esta sesión
      </small>
      {incorrect && (
        <small className="score-help">
          La respuesta del test es incorrecta. Queda suspendida.
        </small>
      )}
      <small className="score-help">{hint}</small>
    </>
  );
}
