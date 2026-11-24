"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Card, Folder } from "../../lib/study/legacy";
import type { CardSession, SessionItem } from "../../lib/memory/session";
import { previewSessionQueue } from "../../lib/memory/queuePreview";
import { failureGap } from "../../lib/memory/reinforcement";
import { cardSearchText } from "../../lib/study/cardSearch";
import { formatScore } from "../../lib/memory/grades";
import BottomSheet from "../sheets/BottomSheet";
import Icon from "../shared/Icon";

const QueueRow = memo(function QueueRow({
  card,
  item,
  label,
  position,
  move,
  folder,
}: {
  card: Card;
  item: SessionItem;
  label?: string;
  position?: number;
  move?: number;
  folder?: string;
}) {
  const question = useMemo(() => cardSearchText(card.front), [card.front]);
  const status =
    label ??
    (item.status === "new"
      ? "Sin ver en esta sesión"
      : item.status === "remembered"
        ? "Aprobada"
        : item.status === "skipped"
          ? "Pasada"
          : "Por reforzar");
  return (
    <li
      className={`session-queue-row ${move ? "queue-row-moved" : ""}`}
      data-queue-id={item.id}
    >
      {position !== undefined && (
        <span className="queue-number">{position}</span>
      )}
      <div>
        <strong>{question.slice(0, 240) || "Tarjeta sin enunciado"}</strong>
        {folder && <small>{folder}</small>}
        <span className={`queue-row-state queue-state-${item.status}`}>
          {status}
          {item.lastScore !== undefined
            ? ` · Última ${formatScore(item.lastScore)}`
            : item.priorityScore !== undefined
              ? ` · Media inicial ${formatScore(item.priorityScore)}`
              : ""}
        </span>
      </div>
      {!!move && (
        <span
          className="queue-move"
          aria-label={`Ha ${move > 0 ? "bajado" : "subido"} ${Math.abs(move)} posiciones`}
        >
          {move > 0 ? "↓" : "↑"} {Math.abs(move)}
        </span>
      )}
    </li>
  );
});

export default function SessionQueuePanel({
  session,
  cards,
  folders,
  currentIds,
  activeIds,
  now,
  onClose,
  busy,
}: {
  session: CardSession;
  cards: Card[];
  folders: Folder[];
  currentIds: string[];
  activeIds: string[];
  now: number;
  onClose: () => void;
  busy?: boolean;
}) {
  const [wide, setWide] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches,
  );
  const [limit, setLimit] = useState(30);
  const [approvedOpen, setApprovedOpen] = useState(false);
  const [approvedLimit, setApprovedLimit] = useState(30);
  const [moves, setMoves] = useState<Map<string, number>>(new Map());
  const previous = useRef<{
    turn: number;
    positions: Map<string, number>;
  } | null>(null);
  const activeKey = JSON.stringify(activeIds);
  const model = useMemo(
    () =>
      previewSessionQueue(session, cards, now, JSON.parse(activeKey), limit),
    [session, cards, now, activeKey, limit],
  );
  const byCard = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards],
  );
  const byFolder = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders],
  );
  const byItem = useMemo(
    () => new Map(session.items.map((item) => [item.id, item])),
    [session.items],
  );
  const orderKey = JSON.stringify([
    ...activeIds,
    ...model.upcoming.map((item) => item.id),
  ]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (busy) return;
    const positions = new Map<string, number>(
      JSON.parse(orderKey).map((id: string, index: number) => [id, index]),
    );
    const before = previous.current;
    if (before && before.turn !== session.turn) {
      const changed = new Map<string, number>();
      for (const [id, position] of positions) {
        const old = before.positions.get(id);
        if (old !== undefined && old !== position)
          changed.set(id, position - old);
      }
      setMoves(changed);
    }
    previous.current = { turn: session.turn, positions };
  }, [orderKey, session.turn, busy]);
  useEffect(() => {
    if (!wide) return;
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !document.querySelector('[aria-modal="true"]')
      )
        onClose();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [wide, onClose]);
  const row = (item: SessionItem, position?: number, label?: string) => (
    <QueueRow
      key={item.id}
      card={byCard.get(item.id)!}
      item={item}
      position={position}
      label={label}
      move={moves.get(item.id)}
      folder={byFolder.get(byCard.get(item.id)!.folderId)}
    />
  );
  const content = (
    <div className="session-queue-content">
      <p className="queue-explanation">
        Orden previsto: cambia al responder. Las siguientes posiciones suponen
        que vas aprobando.
        {session.grading === "scores-v1" &&
          session.format !== "orthography" && (
            <>
              {" "}
              Tras un primer suspenso deben mediar al menos{" "}
              {failureGap(session.items.length, 1)} tarjetas distintas
              contestadas. Entre las listas vuelve primero la de peor nota.
            </>
          )}
      </p>
      <p className="queue-counts" role="status">
        {model.approved.length} aprobadas ·{" "}
        {model.total - model.approved.length} pendientes
      </p>
      {currentIds.some((id) => byCard.has(id) && byItem.has(id)) && (
        <section data-queue-section="current" aria-label="Tarjeta en pantalla">
          <h3>En pantalla</h3>
          <ul>
            {currentIds
              .filter((id) => byCard.has(id) && byItem.has(id))
              .map((id) =>
                row(
                  byItem.get(id)!,
                  undefined,
                  activeIds.includes(id) ? "Ahora" : "Consultando",
                ),
              )}
          </ul>
        </section>
      )}
      <section data-queue-section="upcoming" aria-label="Próximas tarjetas">
        <h3>Próximas</h3>
        {model.upcoming.length ? (
          <ol>{model.upcoming.map((item, index) => row(item, index + 1))}</ol>
        ) : (
          <p>No hay otra tarjeta preparada en esta vuelta.</p>
        )}
        {model.hasMore && (
          <button
            className="ux-link"
            onClick={() => setLimit((value) => value + 30)}
          >
            Mostrar 30 más
          </button>
        )}
      </section>
      {model.held.length > 0 && (
        <details className="queue-held" data-queue-section="held">
          <summary>Pendientes de refuerzo · {model.held.length}</summary>
          <p>
            {model.waiting
              ? "Esperando para repetir."
              : "Quedan para otra vuelta. Puedes retomarlas desde el resumen cuando tú decidas."}
          </p>
          <ul>{model.held.map((item) => row(item))}</ul>
        </details>
      )}
      <details
        data-queue-section="approved"
        open={approvedOpen}
        onToggle={(event) => setApprovedOpen(event.currentTarget.open)}
      >
        <summary>Aprobadas · {model.approved.length}</summary>
        {approvedOpen && (
          <>
            <p>Ya no se repiten en esta sesión.</p>
            <ul>
              {model.approved.slice(0, approvedLimit).map((item) => row(item))}
            </ul>
            {model.approved.length > approvedLimit && (
              <button
                className="ux-link"
                onClick={() => setApprovedLimit((value) => value + 30)}
              >
                Mostrar más aprobadas
              </button>
            )}
          </>
        )}
      </details>
      {model.missing > 0 && (
        <small>{model.missing} tarjetas ya no están disponibles.</small>
      )}
    </div>
  );
  if (!wide)
    return (
      <BottomSheet
        title="Cola de la sesión"
        onClose={onClose}
        className="session-queue-sheet"
      >
        <div id="live-session-queue">{content}</div>
      </BottomSheet>
    );
  return (
    <aside
      className="session-queue-panel"
      id="live-session-queue"
      aria-labelledby="session-queue-title"
    >
      <header>
        <h2 id="session-queue-title">Cola de la sesión</h2>
        <button
          className="icon-button"
          aria-label="Cerrar cola de la sesión"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="session-queue-scroll">{content}</div>
    </aside>
  );
}
