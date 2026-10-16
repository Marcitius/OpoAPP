"use client";
import { useState } from "react";
import type { AppState } from "../../lib/study/legacy";
import { uid, isOrthographyCard } from "../../lib/study/legacy";
import { plainRichText } from "../../app/RichTextEditor";
import {
  reviewCollections,
  cardsInCollection,
  type ReviewCollection,
} from "../../lib/review/collections";
import { scopedCards, searchText } from "../../lib/study/selection";
import ContentScope from "../filters/ContentScope";
import BottomSheet from "../sheets/BottomSheet";
import Icon from "../shared/Icon";
export default function ReviewCollections({
  state,
  onStart,
  onRemove,
  onCollection,
  onSave,
  onChooseMode,
}: {
  state: AppState;
  onStart: (ids: string[], collectionId: string) => void;
  onChooseMode: (ids: string[], collectionId: string) => void;
  onRemove: (id: string, ids: string[]) => Promise<boolean>;
  onCollection: (c: ReviewCollection) => Promise<boolean>;
  onSave: (ids: string[]) => void;
}) {
  const [active, setActive] = useState<string | null>(null),
    [folders, setFolders] = useState<string[]>([]),
    [nodes, setNodes] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [editor, setEditor] = useState<ReviewCollection | null>(null),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false);
  const collections = reviewCollections(state.settings),
    c = collections.find((c) => c.id === active),
    scope = new Set(scopedCards(state, folders, nodes).map((c) => c.id)),
    cards = active
      ? cardsInCollection(state, active).filter(
          (c) =>
            scope.has(c.id) &&
            searchText(
              plainRichText(c.front) + " " + plainRichText(c.back),
            ).includes(searchText(query)),
        )
      : [],
    ordinary = cards.filter((c) => !isOrthographyCard(c));
  const edit = (c: ReviewCollection) => {
    setEditor(c);
    setName(c.name);
  };
  return (
    <section className="review-collections">
      <div className="ux-section-head">
        <h2>Mis repasos</h2>
        <button
          className="ux-link"
          onClick={() => edit({ id: uid(), name: "" })}
        >
          + Colección
        </button>
      </div>
      {!c ? (
        <div className="collection-grid">
          {collections.map((c) => (
            <div className="collection-item" key={c.id}>
              <button
                className="simple-row"
                onClick={() => {
                  setActive(c.id);
                  setSelected([]);
                }}
              >
                <span>
                  <strong>{c.name}</strong>
                  <small>
                    {cardsInCollection(state, c.id).length} tarjetas guardadas
                  </small>
                </span>
                <Icon name="chevron" />
              </button>
              <button
                className="icon-button"
                aria-label={`Editar colección ${c.name}`}
                onClick={() => edit(c)}
              >
                <Icon name="more" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <>
          <button
            className="ux-link"
            onClick={() => {
              setActive(null);
              setSelected([]);
            }}
          >
            ← Todas las colecciones
          </button>
          <h3>{c.name}</h3>
          <ContentScope
            state={state}
            folders={folders}
            nodes={nodes}
            onFolders={setFolders}
            onNodes={setNodes}
          />
          <div className="ux-search">
            <Icon name="search" />
            <input
              aria-label="Buscar en colección"
              placeholder="Buscar tarjeta…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            className="primary-button full"
            disabled={!cards.length}
            onClick={() =>
              onStart(
                (ordinary.length ? ordinary : cards).map((c) => c.id),
                c.id,
              )
            }
          >
            Empezar repaso · {cards.length}{" "}
            {cards.length === 1 ? "tarjeta" : "tarjetas"}
          </button>
          <button
            className="ux-link collection-mode-action"
            disabled={!cards.length}
            onClick={() =>
              onChooseMode(
                cards.map((card) => card.id),
                c.id,
              )
            }
          >
            Elegir modo de estudio
          </button>
          {ordinary.length > 0 && ordinary.length < cards.length && (
            <>
              <button
                className="secondary-button full"
                onClick={() =>
                  onStart(
                    cards.filter(isOrthographyCard).map((c) => c.id),
                    c.id,
                  )
                }
              >
                Repasar ortografía
              </button>
              <p className="muted">
                Ortografía se practica en su sesión de palabras; el botón
                principal abre las demás tarjetas.
              </p>
            </>
          )}
          <p className="muted">
            Responder no las elimina de esta colección. Puedes retirarlas cuando
            quieras.
          </p>
          {!!cards.length && (
            <div className="selection-toolbar">
              <button
                className="ux-link"
                onClick={() => setSelected(cards.map((c) => c.id))}
              >
                Seleccionar resultados
              </button>
              <button className="ux-link" onClick={() => setSelected([])}>
                Limpiar
              </button>
              {!!selected.length && (
                <>
                  <button
                    className="secondary-button"
                    onClick={() => onChooseMode(selected, c.id)}
                  >
                    Estudiar selección
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => onSave(selected)}
                  >
                    Guardar en otra colección
                  </button>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        if (await onRemove(c.id, selected)) setSelected([]);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Quitar {selected.length} de aquí
                  </button>
                </>
              )}
            </div>
          )}
          <div className="simple-list">
            {cards.map((card) => (
              <div className="collection-card" key={card.id}>
                <button
                  className={`selection-check ${selected.includes(card.id) ? "selected" : ""}`}
                  aria-label={`Seleccionar tarjeta ${plainRichText(card.front)}`}
                  aria-pressed={selected.includes(card.id)}
                  onClick={() =>
                    setSelected((ids) =>
                      ids.includes(card.id)
                        ? ids.filter((id) => id !== card.id)
                        : [...ids, card.id],
                    )
                  }
                >
                  {selected.includes(card.id) ? "✓" : ""}
                </button>
                <button
                  className="collection-card-main"
                  onClick={() => onStart([card.id], c.id)}
                >
                  <strong>{plainRichText(card.front)}</strong>
                  <small>
                    {state.folders.find((f) => f.id === card.folderId)?.name}
                  </small>
                </button>
                <button
                  className="ux-link collection-remove"
                  disabled={busy}
                  aria-label={`Quitar de ${c.name}: ${plainRichText(card.front)}`}
                  onClick={async () => {
                    if (busy) return;
                    setBusy(true);
                    try {
                      if (await onRemove(c.id, [card.id]))
                        setSelected((ids) =>
                          ids.filter((id) => id !== card.id),
                        );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Quitar de aquí
                </button>
                <button
                  className="icon-button"
                  aria-label={`Colecciones de ${plainRichText(card.front)}`}
                  onClick={() => onSave([card.id])}
                >
                  <Icon name="more" />
                </button>
              </div>
            ))}
          </div>
          {!cards.length && (
            <p className="empty-inline">
              No hay tarjetas con esta selección. Puedes guardarlas mientras
              estudias o desde Biblioteca.
            </p>
          )}
        </>
      )}
      {editor && (
        <BottomSheet
          title={editor.name ? "Editar colección" : "Nueva colección"}
          onClose={() => setEditor(null)}
          dismissible={!busy}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim() || busy) return;
              setBusy(true);
              try {
                if (await onCollection({ ...editor, name: name.trim() }))
                  setEditor(null);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Nombre
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <button
              className="primary-button full"
              disabled={busy || !name.trim()}
            >
              Guardar colección
            </button>
          </form>
          {collections.some((c) => c.id === editor.id) && (
            <button
              className="sheet-action danger-text"
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm(
                    "¿Eliminar esta colección? Las tarjetas y su historial se conservan.",
                  )
                )
                  return;
                setBusy(true);
                try {
                  if (await onCollection({ ...editor, deleted: true })) {
                    setEditor(null);
                    if (active === editor.id) setActive(null);
                  }
                } finally {
                  setBusy(false);
                }
              }}
            >
              Eliminar colección
            </button>
          )}
        </BottomSheet>
      )}
    </section>
  );
}
