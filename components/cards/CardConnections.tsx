"use client";
import { useState } from "react";
import type { Card } from "../../lib/study/legacy";
import { sourceNeedsReview } from "../../lib/cards/derived";
import { RichContent, plainRichText } from "../../app/RichTextEditor";
import BottomSheet from "../sheets/BottomSheet";
export default function CardConnections({
  card,
  cards,
  onClose,
  onEdit,
  onAcknowledge,
}: {
  card: Card;
  cards: Card[];
  onClose: () => void;
  onEdit: (id: string) => void;
  onAcknowledge: (id: string) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const source = cards.find((c) => c.id === card.derivation?.sourceCardId);
  const children = cards.filter((c) => c.derivation?.sourceCardId === card.id);
  const preview = cards.find((c) => c.id === selected);
  return (
    <BottomSheet
      title="Tarjetas relacionadas"
      onClose={onClose}
      fullScreen
      className="card-connections"
    >
      {preview ? (
        <>
          <button className="ux-link" onClick={() => setSelected(null)}>
            ← Volver a las relacionadas
          </button>
          <RichContent html={preview.front} />
          <RichContent html={preview.back} />
          {(preview.type === "choice" || preview.type === "test") && (
            <ul>
              {(preview.correctOptions.length
                ? preview.correctOptions
                : [preview.correctOption]
              ).map((i) => (
                <li key={i}>{preview.options[i]}</li>
              ))}
            </ul>
          )}
          <button
            className="secondary-button full"
            onClick={() => onEdit(preview.id)}
          >
            Editar tarjeta relacionada
          </button>
        </>
      ) : (
        <>
          {card.derivation && (
            <section>
              <h3>Tarjeta de origen</h3>
              {source ? (
                <button
                  className="sheet-action"
                  onClick={() => setSelected(source.id)}
                >
                  {plainRichText(source.front)}
                </button>
              ) : (
                <p>
                  La tarjeta de origen se eliminó. Referencia conservada:{" "}
                  {card.derivation.sourceContent.question}
                </p>
              )}
              {sourceNeedsReview(card, cards) && (
                <p role="status">
                  El contenido de origen ha cambiado. Revisa esta derivada antes
                  de seguir estudiándola.
                </p>
              )}
            </section>
          )}
          {sourceNeedsReview(card, cards) && (
            <button
              className="secondary-button full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onAcknowledge(card.id);
                } finally {
                  setBusy(false);
                }
              }}
            >
              He revisado esta derivada
            </button>
          )}
          <h3>Tarjetas derivadas · {children.length}</h3>
          <p className="muted">
            Cada tarjeta conserva sus propias calificaciones y repasos.
          </p>
          <ul className="card-notes-list">
            {children.map((c) => (
              <li key={c.id}>
                <button
                  className="sheet-action"
                  onClick={() => setSelected(c.id)}
                >
                  {plainRichText(c.front)}
                </button>
                {sourceNeedsReview(c, cards) && (
                  <small>Revisar: el contenido de origen ha cambiado.</small>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </BottomSheet>
  );
}
