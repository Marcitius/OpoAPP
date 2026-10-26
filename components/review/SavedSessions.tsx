import { useState } from "react";
import type { CardSession } from "../../lib/memory/session";
import ResumeSession from "./ResumeSession";
import BottomSheet from "../sheets/BottomSheet";

export default function SavedSessions({
  sessions,
  onResume,
  onFinish,
}: {
  sessions: CardSession[];
  onResume: (id: string) => void;
  onFinish: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
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
        {sessions.length > 1 && (
          <button className="ux-link" onClick={() => setOpen(true)}>
            Ver las {sessions.length} sesiones
          </button>
        )}
      </div>
      {row(sessions[0])}
      {open && (
        <BottomSheet title="Sesiones guardadas" onClose={() => setOpen(false)}>
          <p>
            Elige cuál continuar. Puedes empezar otras desde Biblioteca sin
            perder estas.
          </p>
          <div className="saved-sessions-list">{sessions.map(row)}</div>
        </BottomSheet>
      )}
    </section>
  );
}
