"use client";
import { useState } from "react";
import type { AppState } from "../../lib/study/legacy";
import { uid } from "../../lib/study/legacy";
import {
  reviewCollections,
  inCollection,
  type ReviewCollection,
} from "../../lib/review/collections";
import BottomSheet from "../sheets/BottomSheet";
export default function SaveReviewSheet({
  state,
  cardIds,
  onClose,
  onAssign,
  onCollection,
}: {
  state: AppState;
  cardIds: string[];
  onClose: () => void;
  onAssign: (id: string, ids: string[], saved: boolean) => Promise<boolean>;
  onCollection: (c: ReviewCollection) => Promise<boolean>;
}) {
  const [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <BottomSheet
      title="Guardar para repasar"
      subtitle="Permanecen aquí hasta que tú las retires."
      onClose={onClose}
      dismissible={!busy}
    >
      {reviewCollections(state.settings).map((c) => {
        const count = cardIds.filter((id) =>
            inCollection(state.settings, c.id, id),
          ).length,
          all = count === cardIds.length;
        return (
          <button
            type="button"
            className="sheet-action"
            key={c.id}
            aria-label={c.name}
            aria-pressed={all}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onAssign(c.id, cardIds, !all);
              } finally {
                setBusy(false);
              }
            }}
          >
            <span
              className={`selection-check ${all ? "selected" : ""}`}
              aria-hidden="true"
            >
              {all ? "✓" : count ? "−" : ""}
            </span>
            <span>
              {c.name}
              {count > 0 && cardIds.length > 1 && (
                <small> · {count} guardadas</small>
              )}
            </span>
          </button>
        );
      })}
      {!creating ? (
        <button
          type="button"
          className="ux-link"
          onClick={() => setCreating(true)}
        >
          + Crear colección
        </button>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim() || busy) return;
            setBusy(true);
            try {
              const c = { id: uid(), name: name.trim() };
              if (await onCollection(c)) {
                await onAssign(c.id, cardIds, true);
                setCreating(false);
                setName("");
              }
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Nombre de la colección
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="secondary-button" disabled={busy || !name.trim()}>
            Crear y guardar
          </button>
        </form>
      )}
      <button
        type="button"
        className="primary-button full"
        disabled={busy}
        onClick={onClose}
      >
        Continuar
      </button>
      <p className="muted">
        Guardar no califica la respuesta ni cambia la fecha del próximo repaso.
      </p>
    </BottomSheet>
  );
}
