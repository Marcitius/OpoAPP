"use client";
import { useDeferredValue, useMemo, useState } from "react";
import type { Card, Folder } from "../../lib/study/legacy";
import {
  cardCorrectOptions,
  cardTypeLabel,
  isMultipleChoiceCard,
} from "../../lib/study/legacy";
import {
  cardSearchExcerpt,
  createCardSearchIndex,
  searchCards,
} from "../../lib/study/cardSearch";
import { RichContent } from "../../app/RichTextEditor";
import BottomSheet from "../sheets/BottomSheet";
import Icon from "../shared/Icon";

export default function GlobalCardSearch({
  cards,
  folders,
  onClose,
  onStudy,
  onEdit,
  onNotes,
  onDerive,
  onConnections,
}: {
  cards: Card[];
  folders: Folder[];
  onClose: () => void;
  onStudy: (id: string) => void;
  onEdit: (id: string) => void;
  onNotes?: (id: string) => void;
  onDerive?: (id: string) => void;
  onConnections?: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const searching = !!query.trim();
  const index = useMemo(
    () => (searching ? createCardSearchIndex(cards) : []),
    [cards, searching],
  );
  const results = useMemo(
    () => searchCards(index, deferred),
    [index, deferred],
  );
  const [limit, setLimit] = useState(40);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId
    ? cards.find((card) => card.id === selectedId)
    : null;
  const folderNames = useMemo(() => {
    const map = new Map(folders.map((folder) => [folder.id, folder]));
    const paths = new Map<string, string>();
    for (const folder of folders) {
      const parts: string[] = [],
        seen = new Set<string>();
      let current: Folder | undefined = folder;
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        parts.unshift(current.name);
        current = current.parentId ? map.get(current.parentId) : undefined;
      }
      paths.set(folder.id, parts.join(" › "));
    }
    return paths;
  }, [folders]);
  return (
    <BottomSheet
      title="Buscar tarjetas"
      onClose={onClose}
      fullScreen
      className="global-card-search"
    >
      <label className="global-search-field">
        <span>Pregunta o respuesta · todos los temas</span>
        <div>
          <Icon name="search" />
          <input
            aria-label="Buscar por pregunta o respuesta"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(40);
              setSelectedId(null);
            }}
            placeholder="Escribe una palabra o una frase"
            autoComplete="off"
          />
        </div>
      </label>
      {selectedId ? (
        <section
          className="global-search-preview"
          aria-label="Vista de la tarjeta"
        >
          <button className="ux-link" onClick={() => setSelectedId(null)}>
            <Icon name="back" size={18} /> Volver a resultados
          </button>
          {selected ? (
            <>
              <small>
                {folderNames.get(selected.folderId)} ·{" "}
                {cardTypeLabel(selected.type)}
              </small>
              <RichContent
                html={selected.front}
                className="search-preview-question"
              />
              <span className="ux-label">RESPUESTA</span>
              {isMultipleChoiceCard(selected) && (
                <ul>
                  {cardCorrectOptions(selected).map((i) => (
                    <li key={i}>{selected.options[i]}</li>
                  ))}
                </ul>
              )}
              <RichContent html={selected.back} />
              <div className="card-context-actions">
                {onNotes && (
                  <button
                    className="ux-link"
                    onClick={() => onNotes(selected.id)}
                  >
                    Notas de la tarjeta
                  </button>
                )}
                {onDerive && (
                  <button
                    className="ux-link"
                    onClick={() => onDerive(selected.id)}
                  >
                    Crear tarjeta derivada
                  </button>
                )}
                {onConnections && (
                  <button
                    className="ux-link"
                    onClick={() => onConnections(selected.id)}
                  >
                    Tarjetas relacionadas
                  </button>
                )}
              </div>
              <div className="search-preview-actions">
                <button
                  className="primary-button full"
                  onClick={() => onStudy(selected.id)}
                >
                  Estudiar tarjeta
                </button>
                <button
                  className="secondary-button full"
                  onClick={() => onEdit(selected.id)}
                >
                  Editar tarjeta
                </button>
              </div>
            </>
          ) : (
            <p>Esta tarjeta ya no está disponible.</p>
          )}
        </section>
      ) : (
        <>
          <p role="status">
            {query !== deferred
              ? "Buscando…"
              : searching
                ? `${results.length} ${results.length === 1 ? "tarjeta encontrada" : "tarjetas encontradas"}`
                : "Busca en las preguntas y respuestas de toda tu biblioteca."}
          </p>
          {searching && query === deferred && results.length === 0 && (
            <p>No hay tarjetas que coincidan con tu búsqueda.</p>
          )}
          <ul
            className="global-search-results"
            aria-label="Resultados de tarjetas"
            aria-busy={query !== deferred}
          >
            {results.slice(0, limit).map((result) => (
              <li key={result.card.id}>
                <button onClick={() => setSelectedId(result.card.id)}>
                  <small>
                    {folderNames.get(result.card.folderId)} ·{" "}
                    {cardTypeLabel(result.card.type)}
                  </small>
                  <strong>
                    {result.question.slice(0, 260) || "Tarjeta sin enunciado"}
                  </strong>
                  <span className="search-match-label">
                    {result.questionMatch && result.answerMatch
                      ? "Coincide en pregunta y respuesta"
                      : result.questionMatch
                        ? "Coincide en la pregunta"
                        : "Coincide en la respuesta"}
                  </span>
                  <p>
                    {cardSearchExcerpt(
                      result.answerMatch ? result.answer : result.question,
                      deferred,
                    )}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {results.length > limit && (
            <button
              className="secondary-button full"
              onClick={() => setLimit((value) => value + 40)}
            >
              Mostrar más resultados
            </button>
          )}
        </>
      )}
    </BottomSheet>
  );
}
