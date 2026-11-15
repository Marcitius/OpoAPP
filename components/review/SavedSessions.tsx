import { useState } from "react";
import type { CardSession } from "../../lib/memory/session";
import ResumeSession from "./ResumeSession";
import BottomSheet from "../sheets/BottomSheet";
import { sessionSummary } from "../../lib/memory/session";

export default function SavedSessions({
  sessions,
  onResume,
  onFinish,
  onFinishMany,
}: {
  sessions: CardSession[];
  onResume: (id: string) => void;
  onFinish: (id: string) => void;
  onFinishMany: (ids: string[]) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]),
    [confirm, setConfirm] = useState<string[] | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const chosen = selected.filter((id) => sessions.some((s) => s.id === id));
  if (!sessions.length) return null;
  const row = (session: CardSession) => (
    <ResumeSession
      key={session.id}
      session={session}
      onResume={() => {
        setOpen(false);
        onResume(session.id);
      }}
      onFinish={() => {
        setOpen(false);
        onFinish(session.id);
      }}
    />
  );
  return (
    <section className="saved-sessions" aria-label="Sesiones guardadas">
      <div className="saved-sessions-heading">
        <h2>
          {sessions.length === 1
            ? "Tu sesión guardada"
            : "Tus sesiones guardadas"}
        </h2>
        {
          <button
            className="ux-link"
            onClick={() => {
              setSelected([]);
              setConfirm(null);
              setError("");
              setOpen(true);
            }}
          >
            {sessions.length > 1
              ? `Ver las ${sessions.length} sesiones`
              : "Gestionar sesión"}
          </button>
        }
      </div>
      {row(sessions[0])}
      {open && (
        <BottomSheet
          title={
            confirm
              ? `¿Finalizar ${confirm.length} ${confirm.length === 1 ? "sesión" : "sesiones"}?`
              : "Sesiones guardadas"
          }
          dismissible={!busy}
          onClose={() => setOpen(false)}
        >
          {confirm ? (
            <>
              <p>
                Se cerrarán {confirm.length} sesiones. Las tarjetas, notas y el
                historial se conservan.
              </p>
              <p>
                {sessions
                  .filter((s) => confirm.includes(s.id))
                  .reduce(
                    (n, s) =>
                      n +
                      sessionSummary(s).total -
                      sessionSummary(s).remembered,
                    0,
                  )}{" "}
                tarjetas pendientes en esas sesiones. No se marcarán como
                aprendidas.
              </p>
              <ul>
                {sessions
                  .filter((s) => confirm.includes(s.id))
                  .map((s) => (
                    <li key={s.id}>{s.label || "Mis tarjetas"}</li>
                  ))}
              </ul>
              <button
                className="primary-button full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    if (await onFinishMany(confirm)) {
                      setOpen(false);
                      setConfirm(null);
                      setSelected([]);
                    } else
                      setError(
                        "No se ha podido guardar el cierre. Tus sesiones siguen disponibles.",
                      );
                  } catch {
                    setError(
                      "No se ha podido guardar el cierre. Vuelve a intentarlo.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Confirmar finalización
              </button>
              <button
                className="sheet-action"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                Volver sin finalizar
              </button>
              {error && <p role="alert">{error}</p>}
            </>
          ) : (
            <>
              <p>
                Elige cuál continuar. Puedes empezar otras desde Biblioteca sin
                perder estas.
              </p>
              <div className="session-batch-actions">
                <button
                  className="secondary-button"
                  onClick={() => setSelected(sessions.map((s) => s.id))}
                >
                  Seleccionar todas
                </button>
                <button
                  className="ux-link"
                  disabled={!chosen.length}
                  onClick={() => setSelected([])}
                >
                  Limpiar selección
                </button>
                <button
                  className="primary-button"
                  disabled={!chosen.length}
                  onClick={() => setConfirm(chosen)}
                >
                  Finalizar selección ({chosen.length})
                </button>
                <button
                  className="secondary-button"
                  onClick={() => setConfirm(sessions.map((s) => s.id))}
                >
                  Finalizar todas
                </button>
              </div>
              <div className="saved-sessions-list">
                {sessions.map((s, index) => (
                  <div className="selectable-session" key={s.id}>
                    <label>
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar sesión ${index + 1}: ${s.label || "Mis tarjetas"}`}
                        checked={chosen.includes(s.id)}
                        onChange={(e) =>
                          setSelected((ids) =>
                            e.target.checked
                              ? [...ids, s.id]
                              : ids.filter((id) => id !== s.id),
                          )
                        }
                      />
                      Seleccionar
                    </label>
                    {row(s)}
                  </div>
                ))}
              </div>
            </>
          )}
        </BottomSheet>
      )}
    </section>
  );
}
