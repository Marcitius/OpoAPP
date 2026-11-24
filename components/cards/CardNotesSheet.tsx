"use client";
import { useRef, useState } from "react";
import type { Card } from "../../lib/study/legacy";
import type { CardNote } from "../../lib/cards/notes";
import { plainRichText } from "../../app/RichTextEditor";
import BottomSheet from "../sheets/BottomSheet";
const suggestions = [
  "Olvidé quién lo decide",
  "Olvidé el plazo",
  "Confundí la mayoría",
  "Me salté una condición o excepción",
];
export default function CardNotesSheet({
  card,
  notes,
  onClose,
  onSave,
  onChange,
  onDerive,
}: {
  card: Card;
  notes: CardNote[];
  onClose: () => void;
  onSave: (id: string | null, text: string) => Promise<boolean>;
  onChange: (
    id: string,
    action: "resolve" | "reopen" | "delete",
  ) => Promise<boolean>;
  onDerive: (noteId?: string) => void;
}) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    gate = useRef(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const [remove, setRemove] = useState<string | null>(null);
  const dirty =
    text.trim() !== (notes.find((n) => n.id === editing)?.text ?? "");
  const close = () => (dirty ? setDiscard(true) : onClose());
  async function run(work: () => Promise<boolean>, clear = false) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError("");
    try {
      if (await work()) {
        if (clear) {
          setText("");
          setEditing(null);
        }
        setRemove(null);
      } else
        setError(
          "No se ha podido guardar. Tu texto sigue aquí; vuelve a intentarlo.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido guardar.");
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return (
    <BottomSheet
      title="Notas de la tarjeta"
      subtitle={plainRichText(card.front)}
      fullScreen
      onClose={close}
      dismissible={!busy}
      className="card-notes-sheet"
    >
      <p className="muted">
        Anota qué parte te cuesta. Es opcional, se incluye en el informe y no
        cambia tu nota.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => onSave(editing, text), true);
        }}
      >
        <label>
          {editing ? "Editar nota" : "Añadir nota"}
          <textarea
            aria-label="Nota de la tarjeta"
            rows={4}
            maxLength={10000}
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            placeholder="Por ejemplo: recuerdo el plazo, pero olvido quién lo decide."
          />
        </label>
        <div className="note-suggestions">
          {suggestions.map((s) => (
            <button
              type="button"
              className="note-chip"
              disabled={busy}
              key={s}
              onClick={() => setText((t) => (t ? t + "\n" + s : s))}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="card-context-actions">
          <button
            className="primary-button"
            disabled={busy || !text.trim() || !dirty}
          >
            {busy ? "Guardando…" : "Guardar nota"}
          </button>
          {editing && (
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setText("");
              }}
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {discard && (
        <div className="note-confirm" role="alert">
          <p>Tienes una nota sin guardar.</p>
          <button
            className="secondary-button"
            onClick={() => setDiscard(false)}
          >
            Seguir escribiendo
          </button>
          <button className="sheet-action danger-text" onClick={onClose}>
            Descartar y cerrar
          </button>
        </div>
      )}
      <h3>{notes.length ? "Mis observaciones" : "Todavía no hay notas"}</h3>
      <ul className="card-notes-list">
        {notes.map((n) => (
          <li key={n.id} className={n.resolvedAt ? "note-resolved" : ""}>
            <small>
              {new Date(n.createdAt).toLocaleString("es-ES")} ·{" "}
              {n.resolvedAt ? "Resuelta" : "Pendiente"}
            </small>
            <p className="note-text">{n.text}</p>
            <div className="card-context-actions">
              <button
                className="ux-link"
                disabled={busy || dirty}
                onClick={() => {
                  setEditing(n.id);
                  setText(n.text);
                }}
              >
                Editar nota
              </button>
              <button
                className="ux-link"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    onChange(n.id, n.resolvedAt ? "reopen" : "resolve"),
                  )
                }
              >
                {n.resolvedAt ? "Marcar pendiente" : "Marcar resuelta"}
              </button>
              <button
                className="ux-link"
                disabled={busy || dirty}
                onClick={() => onDerive(n.id)}
              >
                Crear tarjeta de refuerzo
              </button>
              <button
                className="ux-link danger-text"
                disabled={busy}
                onClick={() => setRemove(n.id)}
              >
                Eliminar nota
              </button>
            </div>
            {remove === n.id && (
              <div className="note-confirm">
                <p>
                  ¿Eliminar esta nota? Su registro del día se conserva en el
                  informe.
                </p>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => setRemove(null)}
                >
                  Cancelar
                </button>
                <button
                  className="sheet-action danger-text"
                  disabled={busy}
                  onClick={() => void run(() => onChange(n.id, "delete"))}
                >
                  Confirmar eliminación de nota
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
