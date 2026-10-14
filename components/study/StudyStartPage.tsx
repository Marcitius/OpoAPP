"use client";
import ContentScope from "../filters/ContentScope";
import { HierarchyPicker } from "../filters/HierarchyPicker";
import { scopedCards } from "../../lib/study/selection";
import type { AppState } from "../../lib/study/legacy";
import { isOrthographyCard } from "../../lib/study/legacy";
import { useState } from "react";
import type { StudyNode, StudyTask } from "../../lib/study/legacy";
import { studyNodePath, dateLabel } from "../../lib/study/legacy";
import Icon from "../shared/Icon";
export default function StudyStartPage({
  state,
  onFilteredCards,
  nodes,
  tasks,
  onContinue,
  onNode,
  onOrganize,
  onPlan,
  newCards,
  onCards,
  onResume,
}: {
  state: AppState;
  onFilteredCards: (ids: string[]) => void;
  nodes: StudyNode[];
  tasks: StudyTask[];
  onContinue: () => void;
  onNode: (id: string) => void;
  onOrganize: () => void;
  onPlan: () => void;
  newCards?: number;
  onCards?: () => void;
  onResume?: () => void;
}) {
  const [fs, setFs] = useState<string[]>([]),
    [ns, setNs] = useState<string[]>([]);
  const filteredCards = scopedCards(state, fs, ns).filter(
    (c) => !isOrthographyCard(c),
  );
  const [query, setQuery] = useState("");
  const leaves = nodes.filter(
    (n) => !nodes.some((child) => child.parentId === n.id),
  );
  const matches = query.trim()
    ? nodes.filter((n) =>
        studyNodePath(nodes, n.id)
          .join(" ")
          .toLocaleLowerCase("es")
          .includes(query.toLocaleLowerCase("es")),
      )
    : leaves.slice(0, 12);
  return (
    <section className="ux-page study-start-page">
      <div className="ux-intro">
        <p>Un apartado. Toda tu atención.</p>
      </div>
      {onResume && (
        <button className="primary-button full" onClick={onResume}>
          Retomar sesión de tarjetas <Icon name="arrow" size={18} />
        </button>
      )}
      {!!newCards && onCards && (
        <button className="today-start" onClick={onCards}>
          <span className="action-symbol">
            <Icon name="study" size={26} />
          </span>
          <span className="action-main">
            <small>CONTENIDO NUEVO</small>
            <strong>Aprender tarjetas</strong>
            <span>{newCards} por descubrir · refuerzo incluido</span>
          </span>
          <Icon name="arrow" />
        </button>
      )}
      <ContentScope
        state={state}
        folders={fs}
        nodes={ns}
        onFolders={setFs}
        onNodes={setNs}
      />
      <button
        className="secondary-button full"
        disabled={!filteredCards.length}
        onClick={() => onFilteredCards(filteredCards.map((c) => c.id))}
      >
        Estudiar tarjetas de esta selección · {filteredCards.length}
      </button>
      {tasks.length > 0 && (
        <button className="today-start review-start" onClick={onContinue}>
          <span className="action-symbol">
            <Icon name="study" size={26} />
          </span>
          <span className="action-main">
            <small>TU PLANIFICACIÓN</small>
            <strong>Continuar estudio</strong>
            <span>{nodes.find((n) => n.id === tasks[0].nodeId)?.name}</span>
            <em>{tasks.length} elementos para hoy</em>
          </span>
          <Icon name="arrow" />
        </button>
      )}
      <div className="ux-section-head">
        <h2>
          {tasks.length ? "O elige un apartado" : "¿Por dónde empezamos?"}
        </h2>
        <button className="ux-link" onClick={onOrganize}>
          Temario <Icon name="chevron" size={16} />
        </button>
      </div>
      <HierarchyPicker
        items={nodes}
        value={[]}
        allowRoot={false}
        rootLabel="Mi temario"
        onChange={(ids) => {
          if (ids[0]) onNode(ids[0]);
        }}
      />
      {!nodes.length && (
        <div className="ux-empty">
          <h2>Tu preparación empieza aquí</h2>
          <p>Importa el temario que ya tienes o crea el primero.</p>
          <button className="primary-button" onClick={onOrganize}>
            Añadir temario
          </button>
        </div>
      )}
      {tasks.length > 0 && (
        <button className="ux-link" onClick={onPlan}>
          Ver todas las fechas <Icon name="arrow" size={16} />
        </button>
      )}
    </section>
  );
}
