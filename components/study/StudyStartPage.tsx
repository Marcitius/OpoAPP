"use client";
import { useState } from "react";
import type { StudyNode, StudyTask } from "../../lib/study/legacy";
import { studyNodePath, dateLabel } from "../../lib/study/legacy";
import Icon from "../shared/Icon";
export default function StudyStartPage({
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
      <div className="ux-search">
        <Icon name="search" size={20} />
        <input
          aria-label="Buscar apartado"
          placeholder="Buscar tema, artículo, apartado…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="simple-list">
        {matches.map((n) => (
          <button
            key={n.id}
            className="simple-row"
            onClick={() => onNode(n.id)}
          >
            <span>
              <strong>{n.name}</strong>
              <small>
                {studyNodePath(nodes, n.id).slice(0, -1).join(" · ") ||
                  "Mi temario"}
              </small>
            </span>
            <Icon name="arrow" size={20} />
          </button>
        ))}
        {!nodes.length && (
          <div className="ux-empty">
            <Icon name="study" size={32} />
            <h2>Tu preparación empieza aquí</h2>
            <p>Importa el temario que ya tienes o crea tu primer tema.</p>
            <button className="primary-button" onClick={onOrganize}>
              Añadir temario
            </button>
          </div>
        )}
        {nodes.length > 0 && !matches.length && (
          <p className="empty-inline">No hay apartados con ese nombre.</p>
        )}
      </div>
      {tasks.length > 0 && (
        <button className="ux-link" onClick={onPlan}>
          Ver todas las fechas <Icon name="arrow" size={16} />
        </button>
      )}
    </section>
  );
}
