"use client";
import { useRef, useState } from "react";
import type { Card } from "../../lib/study/legacy";
import { plainRichText } from "../../app/RichTextEditor";
import BottomSheet from "../sheets/BottomSheet";
export default function DeleteCardSheet({
  card,
  studying,
  onClose,
  onDelete,
}: {
  card: Card;
  studying: boolean;
  onClose: () => void;
  onDelete: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false),
    gate = useRef(false);
  const [error, setError] = useState("");
  return (
    <BottomSheet title="Eliminar tarjeta" onClose={onClose} dismissible={!busy}>
      <p>{plainRichText(card.front)}</p>
      <p>
        Se eliminará de Biblioteca, las colecciones de repaso y las sesiones
        abiertas. Esta acción no se puede deshacer.
      </p>
      <p className="muted">
        Se conservan las notas y las calificaciones ya registradas para el
        historial y los informes. Sus tarjetas derivadas se mantienen.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button
        className="primary-button full card-delete-confirm"
        disabled={busy}
        onClick={async () => {
          if (gate.current) return;
          gate.current = true;
          setBusy(true);
          try {
            if (!(await onDelete()))
              setError("No se pudo eliminar. Vuelve a intentarlo.");
          } catch {
            setError("No se pudo eliminar. Vuelve a intentarlo.");
          } finally {
            gate.current = false;
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Eliminando…"
          : studying
            ? "Eliminar y continuar"
            : "Confirmar eliminación de tarjeta"}
      </button>
      <button className="sheet-action" disabled={busy} onClick={onClose}>
        Cancelar
      </button>
    </BottomSheet>
  );
}
