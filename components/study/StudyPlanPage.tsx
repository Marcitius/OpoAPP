"use client";
import { useState } from "react";
import type { StudyNode, StudyTask } from "../../lib/study/legacy";
import { dateLabel, localDateKey, studyNodePath } from "../../lib/study/legacy";
import type { PlanAction } from "../../lib/study/planning";
import { dueStudyTasks } from "../../lib/study/planning";
import BottomSheet from "../sheets/BottomSheet";
import Icon from "../shared/Icon";
export default function StudyPlanPage({
  nodes,
  tasks,
  onStart,
  onPlan,
  onEdit,
  onReorder,
  onDelete,
  onTemario,
  onHistory,
}: {
  nodes: StudyNode[];
  tasks: StudyTask[];
  onStart: (task: StudyTask) => void;
  onPlan: (id: string, action: PlanAction) => void;
  onEdit: (id: string) => void;
  onReorder: (id: string, direction: -1 | 1) => void;
  onDelete: (id: string) => void;
  onTemario: () => void;
  onHistory: () => void;
}) {
  const [picker, setPicker] = useState<PlanAction | null>(null),
    [query, setQuery] = useState(""),
    [menu, setMenu] = useState<string | null>(null);
  const pending = tasks.filter((t) => t.status === "pending"),
    today = dueStudyTasks(pending).filter((t) => t.reason === "estudio"),
    next = pending
      .filter(
        (t) => t.reason === "estudio" && !today.some((a) => a.id === t.id),
      )
      .sort((a, b) => a.queueOrder - b.queueOrder),
    reviews = pending
      .filter((t) => t.reason !== "estudio")
      .sort(
        (a, b) =>
          a.plannedFor.localeCompare(b.plannedFor) ||
          a.queueOrder - b.queueOrder,
      ),
    target = pending.find((t) => t.id === menu);
  const row = (task: StudyTask) => {
    const node = nodes.find((n) => n.id === task.nodeId);
    if (!node) return null;
    return (
      <div className="plan-row-v12" key={task.id}>
        <button className="plan-row-main" onClick={() => onStart(task)}>
          <span>
            <strong>{node.name}</strong>
            <small>
              {task.note ||
                (!task.plannedFor
                  ? "A tu ritmo"
                  : task.plannedFor <= localDateKey()
                    ? "Listo para empezar"
                    : dateLabel(task.plannedFor))}
            </small>
          </span>
          <Icon name="arrow" size={20} />
        </button>
        <button
          className="icon-button"
          aria-label={`Opciones de ${node.name}`}
          onClick={() => setMenu(task.id)}
        >
          <Icon name="more" />
        </button>
      </div>
    );
  };
  return (
    <section className="study-plan-v12">
      <p className="ux-intro">
        Elige tu siguiente paso. La organización termina cuando empiezas a
        estudiar.
      </p>
      <div className="plan-columns-v12">
        <section className="plan-block-v12">
          <header>
            <div>
              <span className="ux-label">MI SIGUIENTE PASO</span>
              <h2>
                Hoy <small>{today.length}</small>
              </h2>
            </div>
            <button
              className="icon-button"
              aria-label="Añadir a hoy"
              onClick={() => {
                setPicker("today");
                setQuery("");
              }}
            >
              <Icon name="plus" />
            </button>
          </header>
          {today.map(row)}
          {!today.length && (
            <div className="plan-empty">
              <p>
                No necesitas preparar un calendario. Añade un apartado y
                empieza.
              </p>
              <button
                className="primary-button"
                onClick={() => {
                  setPicker("today");
                  setQuery("");
                }}
              >
                Estudiar hoy
              </button>
            </div>
          )}
          {today.length > 0 && (
            <button
              className="primary-button full"
              onClick={() => onStart(today[0])}
            >
              Continuar estudio <Icon name="arrow" size={18} />
            </button>
          )}
        </section>
        <section className="plan-block-v12">
          <header>
            <div>
              <span className="ux-label">SIN PRISAS</span>
              <h2>
                Después <small>{next.length}</small>
              </h2>
            </div>
            <button
              className="icon-button"
              aria-label="Añadir para después"
              onClick={() => {
                setPicker("next");
                setQuery("");
              }}
            >
              <Icon name="plus" />
            </button>
          </header>
          {next.map(row)}
          {!next.length && (
            <p className="empty-inline">
              Guarda aquí lo que quieres estudiar después, con fecha o sin ella.
            </p>
          )}
        </section>
        <section className="plan-block-v12">
          <header>
            <div>
              <span className="ux-label">PARA NO OLVIDAR</span>
              <h2>
                Repasos <small>{reviews.length}</small>
              </h2>
            </div>
            <button
              className="icon-button"
              aria-label="Añadir repaso para mañana"
              onClick={() => {
                setPicker("review-tomorrow");
                setQuery("");
              }}
            >
              <Icon name="plus" />
            </button>
          </header>
          {reviews.slice(0, 10).map(row)}
          {!reviews.length && (
            <p className="empty-inline">
              Los repasos que marques en el temario aparecerán aquí. Las
              tarjetas se programan solas.
            </p>
          )}
          {reviews.length > 10 && (
            <button className="ux-link" onClick={onTemario}>
              Ver el temario y sus repasos
            </button>
          )}
        </section>
      </div>
      <div className="plan-footer-v12">
        <button className="ux-link" onClick={onTemario}>
          <Icon name="folder" size={18} />
          Ver y organizar temario
        </button>
        <button className="ux-link" onClick={onHistory}>
          Historial <Icon name="chevron" size={16} />
        </button>
      </div>
      {picker && (
        <BottomSheet
          title={
            picker === "today"
              ? "Añadir a hoy"
              : picker === "next"
                ? "Estudiar después"
                : "Repasar mañana"
          }
          onClose={() => setPicker(null)}
        >
          <div className="ux-search">
            <Icon name="search" size={20} />
            <input
              aria-label="Buscar para planificar"
              placeholder="Busca un apartado…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="simple-list">
            {nodes
              .filter((n) =>
                query
                  ? studyNodePath(nodes, n.id)
                      .join(" ")
                      .toLocaleLowerCase("es")
                      .includes(query.toLocaleLowerCase("es"))
                  : !nodes.some((c) => c.parentId === n.id),
              )
              .slice(0, 30)
              .map((n) => (
                <button
                  className="simple-row"
                  key={n.id}
                  onClick={() => {
                    onPlan(n.id, picker);
                    setPicker(null);
                  }}
                >
                  <span>
                    <strong>{n.name}</strong>
                    <small>
                      {studyNodePath(nodes, n.id).slice(0, -1).join(" · ")}
                    </small>
                  </span>
                  <Icon name="plus" size={18} />
                </button>
              ))}
            {!nodes.length && (
              <button
                className="primary-button full"
                onClick={() => {
                  setPicker(null);
                  onTemario();
                }}
              >
                Añadir o importar temario
              </button>
            )}
          </div>
        </BottomSheet>
      )}
      {target && (
        <BottomSheet
          title={nodes.find((n) => n.id === target.nodeId)?.name ?? "Mi plan"}
          onClose={() => setMenu(null)}
        >
          <button
            className="sheet-action"
            onClick={() => {
              setMenu(null);
              onStart(target);
            }}
          >
            <Icon name="study" />
            Estudiar ahora
          </button>
          <button
            className="sheet-action"
            onClick={() => {
              onPlan(target.nodeId, "today");
              setMenu(null);
            }}
          >
            Añadir a hoy
          </button>
          <button
            className="sheet-action"
            onClick={() => {
              onPlan(target.nodeId, "next");
              setMenu(null);
            }}
          >
            Estudiar después
          </button>
          <button
            className="sheet-action"
            onClick={() => {
              onPlan(target.nodeId, "review-tomorrow");
              setMenu(null);
            }}
          >
            Repasar mañana
          </button>
          <hr />
          <button
            className="sheet-action"
            onClick={() => {
              onReorder(target.id, -1);
              setMenu(null);
            }}
          >
            Subir prioridad
          </button>
          <button
            className="sheet-action"
            onClick={() => {
              onReorder(target.id, 1);
              setMenu(null);
            }}
          >
            Bajar prioridad
          </button>
          <button
            className="sheet-action"
            onClick={() => {
              setMenu(null);
              onEdit(target.id);
            }}
          >
            Fecha o nota opcional
          </button>
          <button
            className="sheet-action danger-text"
            onClick={() => {
              onDelete(target.id);
              setMenu(null);
            }}
          >
            Quitar del plan
          </button>
        </BottomSheet>
      )}
    </section>
  );
}
