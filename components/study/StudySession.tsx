"use client";
import { useState } from "react";
import type { StudyAssessment } from "../../lib/study/legacy";
import Icon from "../shared/Icon";
import BottomSheet from "../sheets/BottomSheet";
import { RichContent } from "../../app/RichTextEditor";
export interface StudyEntry {
  nodeId: string;
  taskId?: string;
}
export default function StudySession({
  title,
  path,
  note,
  reference,
  position,
  total,
  status,
  onExit,
  onSkip,
  onComplete,
  done = false,
}: {
  title: string;
  path: string;
  note?: string;
  reference?: string;
  position: number;
  total: number;
  status: string;
  onExit: () => void;
  onSkip: () => void;
  onComplete: (
    assessment: Exclude<StudyAssessment, null>,
    note: string,
  ) => Promise<boolean>;
  done?: boolean;
}) {
  const [rating, setRating] = useState<Exclude<StudyAssessment, null> | null>(
      null,
    ),
    [comment, setComment] = useState(""),
    [sheet, setSheet] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function finish() {
    if (!rating || busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await onComplete(rating, comment);
      if (saved) {
        setSheet(false);
        setComment("");
        setRating(null);
      } else setError("El elemento ha cambiado. Vuelve a abrir la sesión.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div className="study-session immersion">
        <div className="session-complete">
          <span className="completion-mark">
            <Icon name="check" size={32} />
          </span>
          <span className="ux-label">SESIÓN COMPLETADA</span>
          <h1>Un paso más cerca.</h1>
          <p>Tu estudio queda registrado. Buen momento para hacer una pausa.</p>
          <button className="primary-button full" onClick={onExit}>
            Volver a Hoy
          </button>
        </div>
      </div>
    );
  return (
    <div className="study-session immersion">
      <header className="immersion-header">
        <button className="exit-session" onClick={onExit}>
          <Icon name="back" size={20} />
          Salir
        </button>
        <span>
          {position} <small>/ {total}</small>
        </span>
        <small className="session-save" role="status">
          {status}
        </small>
      </header>
      <div className="session-progress-line">
        <i style={{ width: `${Math.max(0, (position - 1) / total) * 100}%` }} />
      </div>
      <main className="study-session-content" key={title + position}>
        <span className="ux-label">SESIÓN DE ESTUDIO</span>
        <p className="session-path">{path}</p>
        <h1>{title}</h1>
        {note && (
          <div className="session-note">
            <span>Recuerda</span>
            <p>{note}</p>
          </div>
        )}
        {reference ? (
          <section className="session-reference">
            <RichContent html={reference} />
          </section>
        ) : (
          <p className="session-guidance">
            Estudia este apartado con tu material. Cuando termines, registra
            cómo ha ido y sigue con el siguiente.
          </p>
        )}
      </main>
      <footer className="study-session-footer">
        <button className="primary-button full" onClick={() => setSheet(true)}>
          Terminar estudio <Icon name="check" size={20} />
        </button>
        <button className="ux-link" onClick={onSkip}>
          Pasar por ahora <Icon name="arrow" size={16} />
        </button>
      </footer>
      {sheet && (
        <BottomSheet
          title="¿Cómo ha ido?"
          subtitle={title}
          onClose={() => !busy && setSheet(false)}
          dismissible={!busy}
          className="assessment-sheet"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void finish();
            }}
          >
            <div className="assessment-buttons">
              {(["mal", "regular", "bien"] as const).map((value) => (
                <button
                  key={value}
                  aria-label={
                    value === "mal"
                      ? "Mal"
                      : value === "regular"
                        ? "Regular"
                        : "Bien"
                  }
                  type="button"
                  aria-pressed={rating === value}
                  className={`${value} ${rating === value ? "selected" : ""}`}
                  onClick={() => setRating(value)}
                >
                  <span>
                    {value === "mal" ? "↻" : value === "regular" ? "≈" : "✓"}
                  </span>
                  {value === "mal"
                    ? "Mal"
                    : value === "regular"
                      ? "Regular"
                      : "Bien"}
                </button>
              ))}
            </div>
            <label>
              Nota <small>opcional</small>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="¿Qué quieres recordar la próxima vez?"
                rows={3}
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="primary-button full" disabled={!rating || busy}>
              {busy ? "Guardando…" : "Guardar y siguiente"}
              <Icon name="arrow" size={18} />
            </button>
          </form>
        </BottomSheet>
      )}
    </div>
  );
}
