"use client";
import { useState, useEffect } from "react";
import type { AppState, StudyMode, CardType } from "../../lib/study/legacy";
import {
  cardsInFolderScope,
  isOrthographyCard,
  cardTypeLabel,
} from "../../lib/study/legacy";
import { plainRichText } from "../../app/RichTextEditor";
import { orderedChildren } from "../../lib/study/hierarchy";
import {
  branchIds,
  hierarchyPath,
  searchText,
  scopedCards,
} from "../../lib/study/selection";
import ContentScope from "../filters/ContentScope";
import { HierarchyPicker } from "../filters/HierarchyPicker";
import BottomSheet from "../sheets/BottomSheet";
import Icon from "../shared/Icon";
export default function LibraryBrowser({
  state,
  parent,
  onParent,
  onOptions,
  onNewCard,
  onEditCard,
  onCardActions,
  onDeleteCards,
  onMove,
  onSave,
  onStart,
  onChooseMode,
  onRename,
  selectionRequest,
}: {
  state: AppState;
  parent: string | null;
  onParent: (id: string | null) => void;
  onOptions: () => void;
  onNewCard: () => void;
  onEditCard: (id: string) => void;
  onCardActions: (id: string) => void;
  onDeleteCards: (ids: string[]) => void;
  onMove: (
    folders: string[],
    cards: string[],
    target: string | null,
  ) => Promise<boolean>;
  onSave: (ids: string[]) => void;
  onStart: (folder?: string, mode?: StudyMode, ids?: string[]) => void;
  onChooseMode: (ids: string[]) => void;
  onRename: (id: string, name: string) => Promise<boolean>;
  selectionRequest: number;
}) {
  const [query, setQuery] = useState(""),
    [type, setType] = useState<CardType | "all">("all"),
    [fs, setFs] = useState<string[]>([]),
    [ns, setNs] = useState<string[]>([]),
    [select, setSelect] = useState(false),
    [folders, setFolders] = useState<string[]>([]),
    [cards, setCards] = useState<string[]>([]),
    [moving, setMoving] = useState(false),
    [target, setTarget] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [rename, setRename] = useState(false),
    [name, setName] = useState("");
  useEffect(() => {
    if (selectionRequest) {
      setSelect(true);
      setFolders([]);
      setCards([]);
    }
  }, [selectionRequest]);
  const current = state.folders.find((f) => f.id === parent),
    filtered =
      !!query.trim() || type !== "all" || fs.length > 0 || ns.length > 0,
    scope = scopedCards(state, fs, ns),
    shownCards = filtered
      ? scope.filter(
          (c) =>
            (type === "all" || c.type === type) &&
            searchText(
              plainRichText(c.front) + " " + plainRichText(c.back),
            ).includes(searchText(query)),
        )
      : orderedChildren(state.cards, parent, "folderId"),
    shownFolders = filtered
      ? query.trim() && type === "all"
        ? state.folders.filter((f) =>
            searchText(f.name).includes(searchText(query)),
          )
        : []
      : orderedChildren(state.folders, parent),
    carried = branchIds(state.folders, folders),
    selected = [
      ...new Set([
        ...cards,
        ...state.cards.filter((c) => carried.has(c.folderId)).map((c) => c.id),
      ]),
    ];
  const clear = () => {
    setFolders([]);
    setCards([]);
  };
  const toggle = (id: string, set: (fn: (ids: string[]) => string[]) => void) =>
    set((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  return (
    <section className="ux-page library-browser-v13">
      <div className="library-top-actions">
        <div className="ux-search">
          <Icon name="search" />
          <input
            aria-label="Buscar biblioteca"
            placeholder="Buscar temas o tarjetas"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          className="primary-button"
          aria-label="Tarjeta"
          onClick={onNewCard}
        >
          + Tarjeta
        </button>
        <button
          className="icon-button"
          aria-label="Opciones de la biblioteca"
          onClick={onOptions}
        >
          <Icon name="more" />
        </button>
      </div>
      <ContentScope
        state={state}
        folders={fs}
        nodes={ns}
        onFolders={setFs}
        onNodes={setNs}
      />
      <div className="library-filter-row">
        <label>
          Tipo
          <select
            aria-label="Filtrar tipo de tarjeta"
            value={type}
            onChange={(e) => setType(e.target.value as CardType | "all")}
          >
            <option value="all">Todos los tipos</option>
            {(
              [
                "basic",
                "choice",
                "test",
                "orthography",
                "written",
              ] as CardType[]
            ).map((t) => (
              <option key={t} value={t}>
                {
                  {
                    basic: "Flashcards",
                    choice: "Vocabulario",
                    test: "Test",
                    orthography: "Ortografía",
                    written: "Respuesta escrita",
                  }[t]
                }
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary-button"
          onClick={() => {
            setSelect(!select);
            clear();
          }}
        >
          {select ? "Cancelar selección" : "Seleccionar"}
        </button>
        {filtered && (
          <button
            className="ux-link"
            onClick={() => {
              setQuery("");
              setType("all");
              setFs([]);
              setNs([]);
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>
      {!filtered && (
        <>
          <button
            className="ux-link"
            disabled={!parent}
            onClick={() => onParent(current?.parentId ?? null)}
          >
            ←{" "}
            {current?.parentId
              ? state.folders.find((f) => f.id === current.parentId)?.name
              : "Biblioteca"}
          </button>
          <div className="ux-section-head">
            <div>
              <small>
                {parent
                  ? hierarchyPath(state.folders, parent)
                      .slice(0, -1)
                      .map((n) => n.name)
                      .join(" › ")
                  : "CONTENIDO DISPONIBLE"}
              </small>
              <h2>{current?.name ?? "Temas de estudio"}</h2>
            </div>
            {current && (
              <button
                className="ux-link"
                onClick={() => {
                  setName(current.name);
                  setRename(true);
                }}
              >
                Editar nombre
              </button>
            )}
          </div>
          {current && !select && (
            <div className="review-modes compact">
              <button onClick={() => onStart(current.id, "learn")}>
                Aprender este tema
              </button>
              <button onClick={() => onStart(current.id, "recommended")}>
                Repaso programado
              </button>
              <button onClick={() => onStart(current.id, "weakest")}>
                Más falladas
              </button>
              <button onClick={() => onStart(current.id, "random")}>
                Aleatorio
              </button>
            </div>
          )}
        </>
      )}
      {select && (
        <div className="selection-toolbar">
          <strong>
            {folders.length} ramas · {selected.length} tarjetas
          </strong>
          <button
            className="ux-link"
            onClick={() => {
              setFolders((ids) => [
                ...new Set([...ids, ...shownFolders.map((f) => f.id)]),
              ]);
              setCards((ids) => [
                ...new Set([...ids, ...shownCards.map((c) => c.id)]),
              ]);
            }}
          >
            Seleccionar este nivel
          </button>
          <button
            className="ux-link"
            onClick={() => {
              setFolders(
                state.folders.filter((f) => !f.parentId).map((f) => f.id),
              );
              setCards(state.cards.map((c) => c.id));
            }}
          >
            Seleccionar todo
          </button>
          <button className="ux-link" onClick={clear}>
            Limpiar selección
          </button>
          <button
            className="primary-button"
            disabled={!folders.length && !cards.length}
            onClick={() => {
              setTarget(null);
              setMoving(true);
            }}
          >
            Mover a…
          </button>
          <button
            className="secondary-button"
            disabled={!selected.length}
            onClick={() => onSave(selected)}
          >
            Guardar para repasar
          </button>
          <button
            className="secondary-button"
            disabled={!selected.length}
            onClick={() => onChooseMode(selected)}
          >
            Estudiar selección
          </button>
          {state.cards.some(
            (c) => selected.includes(c.id) && isOrthographyCard(c),
          ) && (
            <button
              className="secondary-button"
              onClick={() =>
                onChooseMode(
                  state.cards
                    .filter(
                      (c) => selected.includes(c.id) && isOrthographyCard(c),
                    )
                    .map((c) => c.id),
                )
              }
            >
              Estudiar ortografía de la selección
            </button>
          )}
          <button
            className="danger-button"
            disabled={!cards.length || folders.length > 0}
            onClick={() => onDeleteCards(cards)}
          >
            Eliminar tarjetas
          </button>
        </div>
      )}
      <div className="simple-list">
        {shownFolders.map((f) => (
          <div className="library-folder-row" key={f.id}>
            {select && (
              <button
                className={`selection-check ${carried.has(f.id) ? "selected" : ""}`}
                aria-label={`Seleccionar rama ${f.name}`}
                aria-pressed={carried.has(f.id)}
                onClick={() => toggle(f.id, setFolders)}
              >
                {carried.has(f.id) ? "✓" : ""}
              </button>
            )}
            <button
              className="library-row-main"
              aria-label={`Entrar en ${f.name}`}
              onClick={() => {
                onParent(f.id);
                setQuery("");
                setType("all");
                setFs([]);
                setNs([]);
              }}
            >
              <Icon name="folder" />
              <span>
                <strong>{f.name}</strong>
                <small>
                  {cardsInFolderScope(state, f.id).length} tarjetas
                  {filtered
                    ? " · " +
                      hierarchyPath(state.folders, f.id)
                        .slice(0, -1)
                        .map((n) => n.name)
                        .join(" › ")
                    : ""}
                </small>
              </span>
              <Icon name="chevron" />
            </button>
            {!select && (
              <button
                className="icon-button"
                aria-label={`Opciones de ${f.name}`}
                onClick={() => {
                  onParent(f.id);
                  onOptions();
                }}
              >
                <Icon name="more" />
              </button>
            )}
          </div>
        ))}
        {shownCards.map((c) => (
          <div className="library-card-row" key={c.id}>
            {select && (
              <button
                className={`selection-check ${cards.includes(c.id) || carried.has(c.folderId) ? "selected" : ""}`}
                aria-label={`Seleccionar tarjeta ${plainRichText(c.front)}`}
                aria-pressed={cards.includes(c.id) || carried.has(c.folderId)}
                onClick={() => toggle(c.id, setCards)}
              >
                {cards.includes(c.id) || carried.has(c.folderId) ? "✓" : ""}
              </button>
            )}
            <button
              className="library-row-main"
              onClick={() =>
                select
                  ? toggle(c.id, setCards)
                  : onStart(undefined, "all", [c.id])
              }
            >
              <span>
                <small>
                  {cardTypeLabel(c.type)}
                  {filtered
                    ? " · " +
                      hierarchyPath(state.folders, c.folderId)
                        .map((n) => n.name)
                        .join(" › ")
                    : ""}
                </small>
                <strong>{plainRichText(c.front) || "Tarjeta visual"}</strong>
                <small>{plainRichText(c.back).slice(0, 140)}</small>
              </span>
            </button>
            {!select && (
              <>
                <button
                  className="icon-button"
                  aria-label="Editar tarjeta"
                  onClick={() => onEditCard(c.id)}
                >
                  ✎
                </button>
                <button
                  className="icon-button"
                  aria-label="Mover o reordenar tarjeta"
                  onClick={() => onCardActions(c.id)}
                >
                  <Icon name="more" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      {!shownFolders.length && !shownCards.length && (
        <p className="empty-inline">
          {filtered
            ? "No hay coincidencias con estos filtros."
            : "Añade tarjetas o carpetas desde las opciones de Biblioteca."}
        </p>
      )}
      {moving && (
        <BottomSheet
          title="Mover selección"
          subtitle={`${folders.length} ramas y ${selected.length} tarjetas. Se conserva su historial.`}
          onClose={() => setMoving(false)}
          dismissible={!busy}
        >
          <HierarchyPicker
            items={state.folders}
            value={target ? [target] : []}
            onChange={(ids) => setTarget(ids[0] ?? null)}
            blocked={carried}
            rootLabel="Biblioteca · nivel principal"
          />
          <p className="muted">
            Destino:{" "}
            {target
              ? hierarchyPath(state.folders, target)
                  .map((n) => n.name)
                  .join(" › ")
              : "Biblioteca · las tarjetas sueltas irán a Sin carpeta"}
          </p>
          <button
            className="primary-button full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                if (await onMove(folders, cards, target)) {
                  setMoving(false);
                  setSelect(false);
                  clear();
                }
              } finally {
                setBusy(false);
              }
            }}
          >
            Mover selección
          </button>
        </BottomSheet>
      )}
      {rename && current && (
        <BottomSheet title="Nombre de carpeta" onClose={() => setRename(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (name.trim() && (await onRename(current.id, name.trim())))
                setRename(false);
            }}
          >
            <label>
              Nombre
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <button className="primary-button full" disabled={!name.trim()}>
              Guardar nombre
            </button>
          </form>
        </BottomSheet>
      )}
    </section>
  );
}
