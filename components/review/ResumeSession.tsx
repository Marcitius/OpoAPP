import type { CardSession } from "../../lib/memory/session";
import { sessionSummary } from "../../lib/memory/session";
import Icon from "../shared/Icon";

export default function ResumeSession({
  session,
  onResume,
  onFinish,
}: {
  session: CardSession;
  onResume: () => void;
  onFinish: () => void;
}) {
  const summary = sessionSummary(session);
  return (
    <section className="resume-session" aria-label="Sesión guardada">
      <button className="resume-session-main" onClick={onResume}>
        <span className="row-icon">
          <Icon name="review" />
        </span>
        <span>
          <small>SESIÓN GUARDADA</small>
          <strong>{session.label || "Mis tarjetas"}</strong>
          <span>
            {summary.seen} de {summary.total} vistas · {summary.weak} por
            reforzar
          </span>
          <b>
            Continuar sesión <Icon name="arrow" size={16} />
          </b>
        </span>
      </button>
      <button className="ux-link" onClick={onFinish}>
        Finalizar
      </button>
    </section>
  );
}
