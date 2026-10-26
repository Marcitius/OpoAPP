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
  const created = new Date(session.createdAt);
  return (
    <section
      className="resume-session"
      aria-label="Sesión guardada"
      data-session-id={session.id}
    >
      <button className="resume-session-main" onClick={onResume}>
        <span className="row-icon">
          <Icon name="review" />
        </span>
        <span>
          <small>SESIÓN GUARDADA</small>
          <strong>{session.label || "Mis tarjetas"}</strong>
          <span>
            {summary.seen} de {summary.total} vistas ·{" "}
            {summary.total -
              summary.remembered -
              summary.skipped -
              session.items.filter((i) => i.status === "weak").length}{" "}
            pendientes
          </span>
          <span>
            {(
              {
                recommended: "Recomendado",
                all: "Todas",
                learn: "Aprender",
                random: "Aleatorio",
                weakest: "Más falladas",
              } as Record<string, string>
            )[session.mode] ?? "Repaso"}
            {summary.weak > 0 ? ` · ${summary.weak} por reforzar` : ""}
          </span>
          {Number.isFinite(+created) && (
            <time dateTime={session.createdAt}>
              Creada{" "}
              {new Intl.DateTimeFormat("es-ES", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }).format(created)}
            </time>
          )}
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
