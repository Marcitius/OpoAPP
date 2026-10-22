import type { CardSession } from "../../lib/memory/session";
import { sessionSummary } from "../../lib/memory/session";
import Icon from "../shared/Icon";
export default function SessionStatus({
  session,
  readyAt,
  now,
  onClose,
  onFinish,
}: {
  session: CardSession;
  readyAt?: number;
  now: number;
  onClose: () => void;
  onFinish: () => void;
}) {
  const summary = sessionSummary(session),
    seconds = Math.max(1, Math.ceil(((readyAt ?? now) - now) / 1000));
  return (
    <div className="review-overlay immersion session-result-v12">
      <header className="immersion-header">
        <button className="exit-session" onClick={onClose}>
          <Icon name="back" size={20} />
          Salir
        </button>
        <small>Progreso guardado</small>
      </header>
      <div className="session-result-content">
        <span className="completion-mark">
          <Icon name={readyAt ? "review" : "check"} size={34} />
        </span>
        <span className="ux-label">
          {readyAt ? "DALE UN POCO DE ESPACIO" : "VUELTA COMPLETADA"}
        </span>
        <h2>
          {readyAt ? "El refuerzo está preparado." : "Un paso más cerca."}
        </h2>
        <p>
          {readyAt
            ? "Has terminado esta vuelta. Dejamos algo de tiempo antes de volver a preguntarte lo que necesita refuerzo."
            : summary.weak + summary.skipped > 0
              ? "Hay tarjetas por reforzar en un próximo repaso. No las repetimos seguidas para que puedas comprobar lo que recuerdas de verdad. Tus respuestas y próximos repasos están guardados."
              : "Has recordado las tarjetas de esta sesión. Tus próximos repasos están guardados."}
        </p>
        <div className="session-result-counts">
          <div>
            <strong>{summary.seen}</strong>
            <span>Estudiadas</span>
          </div>
          <div>
            <strong>{summary.remembered}</strong>
            <span>Recordadas</span>
          </div>
          <div>
            <strong>{summary.weak + summary.skipped}</strong>
            <span>A reforzar</span>
          </div>
        </div>
        {readyAt ? (
          <>
            <p className="session-wait-time" role="status">
              Próxima tarjeta en{" "}
              {seconds < 60 ? `${seconds} s` : `${Math.ceil(seconds / 60)} min`}
            </p>
            <button className="primary-button full" onClick={onClose}>
              Salir y continuar después
            </button>
            <small>
              Si sigues aquí, aparecerá automáticamente cuando esté lista.
            </small>
          </>
        ) : (
          <>
            <button className="primary-button full" onClick={onFinish}>
              Finalizar sesión
            </button>
            <button className="secondary-button full" onClick={onClose}>
              Salir y conservar sesión
            </button>
            <small>
              La sesión se conserva hasta que pulses Finalizar. Tus respuestas
              permanecen en el historial.
            </small>
          </>
        )}
      </div>
    </div>
  );
}
