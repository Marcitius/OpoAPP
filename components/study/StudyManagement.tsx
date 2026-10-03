"use client";
import { useMemo, useState } from "react";
import {
  StudyAssessment,
  StudyImportNode,
  StudyNode,
  StudyTask,
  addDaysKey,
  countStudyImportNodes,
  dateLabel,
  flattenStudyTree,
  localDateKey,
  normalizeStudyLabel,
  parseStudyTextTree,
  studyDescendantIds,
  studyNodeDepth,
  studyNodePath,
} from "../../lib/study/legacy";
import BottomSheet from "../sheets/BottomSheet";
import { ModalShell } from "../sheets/ModalShell";
import { buildStudyTreePrompt } from "../../lib/chatgptPrompts";

export function StudyTaskCard({
  task,
  node,
  nodes,
  onComplete,
  onPostpone,
  onDelete,
  onEdit,
  onReorder,
  canMoveUp = false,
  canMoveDown = false,
  grouped = false,
}: {
  task: StudyTask;
  node: StudyNode | null;
  nodes: StudyNode[];
  onComplete: (
    taskId: string,
    assessment: Exclude<StudyAssessment, null>,
  ) => void;
  onPostpone: (taskId: string, days?: number) => void;
  onDelete: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onReorder?: (taskId: string, direction: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  grouped?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const overdue = task.plannedFor < localDateKey();
  const path = node ? studyNodePath(nodes, node.id) : [];
  const reasonLabels: Record<string, string> = {
    olvido: "Olvido",
    confusion: "Confusión",
    literalidad: "Literalidad",
    plazo_cifra: "Plazo / cifra",
    afianzar: "Afianzar",
  };
  const runMenuAction = (action: () => void) => {
    setMenuOpen(false);
    action();
  };
  return (
    <article className={`study-task-card ${overdue ? "overdue" : ""}`}>
      <div className="study-task-main">
        <div className="study-task-title-row">
          <strong>{node?.name ?? "Elemento eliminado"}</strong>
          <span className={overdue ? "overdue" : "today"}>
            {overdue ? "Atrasado" : "Hoy"}
          </span>
        </div>
        {!grouped && (
          <small>{path.slice(0, -1).join(" · ") || "Temario"}</small>
        )}
        {task.note && <p>{task.note}</p>}
        {task.reason && (
          <span className="study-reason-chip">
            {reasonLabels[task.reason] ?? task.reason}
          </span>
        )}
      </div>
      <div className="study-task-actions">
        <div
          className="study-assessment-actions"
          aria-label="Resultado del repaso"
        >
          <button className="bad" onClick={() => onComplete(task.id, "mal")}>
            Mal
          </button>
          <button
            className="mid"
            onClick={() => onComplete(task.id, "regular")}
          >
            Regular
          </button>
          <button className="good" onClick={() => onComplete(task.id, "bien")}>
            Bien
          </button>
        </div>
        <div className="study-task-secondary-actions">
          <button onClick={() => onPostpone(task.id, 1)}>Mañana</button>
          <div className={`study-task-more-wrap ${menuOpen ? "open" : ""}`}>
            <button
              className="study-task-more-button"
              aria-label="Más opciones"
              title="Más opciones"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              •••
            </button>
            {menuOpen && (
              <div className="study-task-menu" role="menu">
                <button
                  role="menuitem"
                  onClick={() => runMenuAction(() => onEdit(task.id))}
                >
                  ✎ Editar repaso
                </button>
                <button
                  role="menuitem"
                  onClick={() => runMenuAction(() => onPostpone(task.id, 3))}
                >
                  ＋3 días
                </button>
                <button
                  role="menuitem"
                  onClick={() => runMenuAction(() => onPostpone(task.id, 7))}
                >
                  ＋7 días
                </button>
                {onReorder && (
                  <>
                    <button
                      role="menuitem"
                      disabled={!canMoveUp}
                      onClick={() =>
                        canMoveUp && runMenuAction(() => onReorder(task.id, -1))
                      }
                    >
                      ↑ Subir en la lista
                    </button>
                    <button
                      role="menuitem"
                      disabled={!canMoveDown}
                      onClick={() =>
                        canMoveDown &&
                        runMenuAction(() => onReorder(task.id, 1))
                      }
                    >
                      ↓ Bajar en la lista
                    </button>
                  </>
                )}
                <button
                  role="menuitem"
                  className="danger"
                  onClick={() => runMenuAction(() => onDelete(task.id))}
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function StudyTaskGroupedList({
  tasks,
  nodes,
  onComplete,
  onPostpone,
  onDelete,
  onEdit,
}: {
  tasks: StudyTask[];
  nodes: StudyNode[];
  onComplete: (
    taskId: string,
    assessment: Exclude<StudyAssessment, null>,
  ) => void;
  onPostpone: (taskId: string, days?: number) => void;
  onDelete: (taskId: string) => void;
  onEdit: (taskId: string) => void;
}) {
  const validNodeIds = new Set(nodes.map((node) => node.id));
  const orphanTasks = tasks.filter((task) => !validNodeIds.has(task.nodeId));
  const roots = nodes.filter(
    (node) =>
      !node.parentId &&
      tasks.some((task) => studyDescendantIds(nodes, node.id).has(task.nodeId)),
  );
  return (
    <div className="study-task-groups">
      {roots.map((root) => (
        <StudyTaskGroupBranch
          key={root.id}
          node={root}
          nodes={nodes}
          tasks={tasks}
          depth={0}
          onComplete={onComplete}
          onPostpone={onPostpone}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
      {orphanTasks.length > 0 && (
        <div className="study-task-orphans">
          {orphanTasks.map((task) => (
            <StudyTaskCard
              key={task.id}
              task={task}
              node={null}
              nodes={nodes}
              onComplete={onComplete}
              onPostpone={onPostpone}
              onDelete={onDelete}
              onEdit={onEdit}
              grouped
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function StudyTaskGroupBranch({
  node,
  nodes,
  tasks,
  depth,
  onComplete,
  onPostpone,
  onDelete,
  onEdit,
}: {
  node: StudyNode;
  nodes: StudyNode[];
  tasks: StudyTask[];
  depth: number;
  onComplete: (
    taskId: string,
    assessment: Exclude<StudyAssessment, null>,
  ) => void;
  onPostpone: (taskId: string, days?: number) => void;
  onDelete: (taskId: string) => void;
  onEdit: (taskId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const children = nodes.filter((child) => child.parentId === node.id);
  const directTasks = tasks
    .filter((task) => task.nodeId === node.id)
    .sort(
      (a, b) =>
        a.queueOrder - b.queueOrder || a.createdAt.localeCompare(b.createdAt),
    );
  const childBranches = children.filter((child) =>
    tasks.some((task) => studyDescendantIds(nodes, child.id).has(task.nodeId)),
  );
  const descendantCount =
    directTasks.length +
    childBranches.reduce(
      (sum, child) =>
        sum +
        tasks.filter((task) =>
          studyDescendantIds(nodes, child.id).has(task.nodeId),
        ).length,
      0,
    );
  const isLeaf = childBranches.length === 0;

  if (isLeaf && directTasks.length === 1) {
    return (
      <StudyTaskCard
        task={directTasks[0]}
        node={node}
        nodes={nodes}
        onComplete={onComplete}
        onPostpone={onPostpone}
        onDelete={onDelete}
        onEdit={onEdit}
        grouped
      />
    );
  }

  return (
    <div className={`study-task-group depth-${Math.min(depth, 3)}`}>
      <button
        className="study-task-group-head"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="study-task-group-chevron">{open ? "⌄" : "›"}</span>
        <strong>{node.name}</strong>
        <span className="study-task-group-count">{descendantCount}</span>
      </button>
      {open && (
        <div className="study-task-group-children">
          {directTasks.map((task) => (
            <StudyTaskCard
              key={task.id}
              task={task}
              node={node}
              nodes={nodes}
              onComplete={onComplete}
              onPostpone={onPostpone}
              onDelete={onDelete}
              onEdit={onEdit}
              grouped
            />
          ))}
          {childBranches.map((child) => (
            <StudyTaskGroupBranch
              key={child.id}
              node={child}
              nodes={nodes}
              tasks={tasks}
              depth={depth + 1}
              onComplete={onComplete}
              onPostpone={onPostpone}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function StudyUpcomingRow({
  task,
  node,
  nodes,
  onEdit,
  onDelete,
}: {
  task: StudyTask;
  node: StudyNode | null;
  nodes: StudyNode[];
  onEdit: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="study-upcoming-row">
      <span>
        <strong>{node?.name ?? "Elemento eliminado"}</strong>
        <small>
          {task.note ||
            studyNodePath(nodes, task.nodeId).slice(0, -1).join(" · ") ||
            "Sin nota"}
        </small>
      </span>
      <time>{dateLabel(task.plannedFor)}</time>
      <div className={`study-task-more-wrap ${menuOpen ? "open" : ""}`}>
        <button
          className="study-task-more-button"
          aria-label="Más opciones"
          title="Más opciones"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          •••
        </button>
        {menuOpen && (
          <div className="study-task-menu" role="menu">
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onEdit(task.id);
              }}
            >
              ✎ Editar repaso
            </button>
            <button
              role="menuitem"
              className="danger"
              onClick={() => {
                setMenuOpen(false);
                onDelete(task.id);
              }}
            >
              Eliminar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function StudyTreeBranch({
  node,
  nodes,
  tasks,
  depth,
  onQuick,
  onExport,
  onAddChild,
  onEdit,
  onImportInto,
  onDelete,
  selectionMode,
  selectedIds,
  onToggleSelect,
}: {
  node: StudyNode;
  nodes: StudyNode[];
  tasks: StudyTask[];
  depth: number;
  onQuick: (nodeId?: string | null, sourceCardId?: string | null) => void;
  onExport: (rootId?: string) => void;
  onAddChild: (parentId: string) => void;
  onEdit: (nodeId: string) => void;
  onImportInto: (parentId: string | null) => void;
  onDelete: (nodeId: string) => void;
  selectionMode: boolean;
  selectedIds: string[];
  onToggleSelect: (nodeId: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const children = nodes.filter((child) => child.parentId === node.id);
  const scopedIds = studyDescendantIds(nodes, node.id);
  const scopedTasks = tasks.filter((task) => scopedIds.has(task.nodeId));
  const pending = scopedTasks.filter((task) => task.status === "pending");
  const completed = scopedTasks
    .filter((task) => task.status === "done" && task.completedAt)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const latest = completed[0] ?? null;
  const selected = selectedIds.includes(node.id);
  const visibleOpen = selectionMode || open;
  return (
    <div className={`study-tree-branch depth-${Math.min(depth, 5)}`}>
      <div
        className={`study-tree-row ${selectionMode ? "selecting" : ""} ${selected ? "selected" : ""}`}
      >
        {selectionMode ? (
          <button
            className={`study-tree-select ${selected ? "selected" : ""}`}
            onClick={() => onToggleSelect(node.id)}
            aria-label={
              selected
                ? `Deseleccionar ${node.name}`
                : `Seleccionar ${node.name}`
            }
          >
            {selected ? "✓" : ""}
          </button>
        ) : (
          <button
            className={`study-tree-toggle ${children.length ? "has-children" : "leaf"}`}
            onClick={() => children.length && setOpen((value) => !value)}
            aria-label={
              children.length ? (open ? "Cerrar" : "Abrir") : "Sin subapartados"
            }
          >
            {children.length ? (open ? "⌄" : "›") : "·"}
          </button>
        )}
        <div className="study-tree-name">
          <strong>{node.name}</strong>
          <small>
            {pending.length
              ? `${pending.length} pendiente${pending.length === 1 ? "" : "s"}`
              : latest
                ? `Último repaso ${dateLabel(latest.completedAt)}`
                : children.length
                  ? `${children.length} subapartado${children.length === 1 ? "" : "s"}`
                  : "Sin repasos registrados"}
          </small>
        </div>
        <div className="study-tree-metrics">
          <span>{completed.length} repasos</span>
          {latest?.assessment && (
            <span className={`study-result ${latest.assessment}`}>
              {latest.assessment}
            </span>
          )}
        </div>
        {!selectionMode && (
          <div className="study-tree-actions">
            <button
              className="secondary-button study-tree-review"
              onClick={() => onQuick(node.id)}
            >
              ＋ Repasar
            </button>
            <button
              className="study-tree-mini-button"
              onClick={() => onAddChild(node.id)}
              title="Añadir dentro"
              aria-label={`Añadir dentro de ${node.name}`}
            >
              ＋ Añadir
            </button>
            <button
              className="study-tree-mini-button"
              onClick={() => onImportInto(node.id)}
              title="Importar o actualizar esta rama"
              aria-label={`Importar dentro de ${node.name}`}
            >
              ⇧ Actualizar
            </button>
            <button
              className="study-tree-mini-button"
              onClick={() => onEdit(node.id)}
              title="Editar nombre o ubicación"
              aria-label={`Editar ${node.name}`}
            >
              ✎ Editar
            </button>
            <button
              className={`tree-export-button ${depth === 0 ? "root" : ""}`}
              onClick={() => onExport(node.id)}
              title="Exportar este apartado"
            >
              {depth === 0 ? "↓ Exportar" : "↓"}
            </button>
            <button
              className="study-tree-icon-button danger"
              onClick={() => onDelete(node.id)}
              title="Eliminar esta rama"
              aria-label={`Eliminar ${node.name}`}
            >
              ×
            </button>
          </div>
        )}
      </div>
      {visibleOpen && children.length > 0 && (
        <div className="study-tree-children">
          {children.map((child) => (
            <StudyTreeBranch
              key={child.id}
              node={child}
              nodes={nodes}
              tasks={tasks}
              depth={depth + 1}
              onQuick={onQuick}
              onExport={onExport}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onImportInto={onImportInto}
              onDelete={onDelete}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function StudyQuickModal({
  nodes,
  defaultNodeId,
  onClose,
  onSave,
}: {
  nodes: StudyNode[];
  defaultNodeId: string | null;
  onClose: () => void;
  onSave: (input: {
    nodeId: string;
    plannedFor: string;
    note: string;
    reason: string;
  }) => void;
}) {
  const ordered = useMemo(() => flattenStudyTree(nodes), [nodes]);
  const [nodeId, setNodeId] = useState(
    defaultNodeId && nodes.some((node) => node.id === defaultNodeId)
      ? defaultNodeId
      : "",
  );
  const [plannedFor, setPlannedFor] = useState(addDaysKey(1));
  const [note, setNote] = useState("");
  const [activity, setActivity] = useState<"review" | "study">("review");
  const [reason, setReason] = useState("");
  const selected = nodes.find((node) => node.id === nodeId) ?? null;
  return (
    <ModalShell
      title="Planificar un elemento"
      subtitle="Guárdalo sin salir del flujo de estudio. La nota es opcional."
      label="ESTUDIO O REPASO"
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (nodeId && plannedFor)
            onSave({
              nodeId,
              plannedFor,
              note,
              reason: activity === "study" ? "estudio" : reason,
            });
        }}
      >
        <div className="plan-activity-switch">
          <button
            type="button"
            className={activity === "review" ? "active" : ""}
            onClick={() => setActivity("review")}
          >
            Repasar
          </button>
          <button
            type="button"
            className={activity === "study" ? "active" : ""}
            onClick={() => setActivity("study")}
          >
            Estudiar
          </button>
        </div>
        <label>
          Elemento del temario
          <select
            value={nodeId}
            onChange={(event) => setNodeId(event.target.value)}
          >
            <option value="" disabled>
              Selecciona tema, apartado o artículo…
            </option>
            {ordered.map((node) => (
              <option
                key={node.id}
                value={node.id}
              >{`${"↳ ".repeat(Math.min(studyNodeDepth(nodes, node.id), 4))}${node.name}`}</option>
            ))}
          </select>
        </label>
        {selected && (
          <p className="study-selected-path">
            {studyNodePath(nodes, selected.id).join(" › ")}
          </p>
        )}
        <fieldset>
          <legend>Cuándo</legend>
          <div className="study-date-presets">
            <button
              type="button"
              className={plannedFor === localDateKey() ? "active" : ""}
              onClick={() => setPlannedFor(localDateKey())}
            >
              Hoy
            </button>
            <button
              type="button"
              className={plannedFor === addDaysKey(1) ? "active" : ""}
              onClick={() => setPlannedFor(addDaysKey(1))}
            >
              Mañana
            </button>
            <button
              type="button"
              className={plannedFor === addDaysKey(3) ? "active" : ""}
              onClick={() => setPlannedFor(addDaysKey(3))}
            >
              +3 días
            </button>
            <button
              type="button"
              className={plannedFor === addDaysKey(7) ? "active" : ""}
              onClick={() => setPlannedFor(addDaysKey(7))}
            >
              +7 días
            </button>
          </div>
        </fieldset>
        <label>
          Fecha
          <input
            type="date"
            value={plannedFor}
            onChange={(event) => setPlannedFor(event.target.value)}
          />
        </label>
        <label>
          Motivo <small>(opcional)</small>
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            <option value="">Sin indicar</option>
            <option value="estudio">Estudio planificado</option>
            <option value="olvido">Olvido</option>
            <option value="confusion">Confusión</option>
            <option value="literalidad">Literalidad</option>
            <option value="plazo_cifra">Plazo / cifra</option>
            <option value="afianzar">Quiero afianzarlo</option>
          </select>
        </label>
        <label>
          Nota <small>(opcional)</small>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ej. No olvidar iniciativa de 1/4 y mayoría absoluta"
          />
        </label>
        <button
          className="primary-button full"
          disabled={!nodeId || !plannedFor}
        >
          {activity === "study" ? "Guardar estudio" : "Guardar repaso"}
        </button>
      </form>
    </ModalShell>
  );
}

export function StudyCompletionNoteModal({
  assessment,
  task,
  nodes,
  onClose,
  onSave,
}: {
  assessment: Exclude<StudyAssessment, null>;
  task: StudyTask | null;
  nodes: StudyNode[];
  onClose: () => void;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState(task?.completionNote ?? "");
  const node = task
    ? (nodes.find((item) => item.id === task.nodeId) ?? null)
    : null;
  const labels: Record<Exclude<StudyAssessment, null>, string> = {
    bien: "Bien",
    regular: "Regular",
    mal: "Mal",
  };
  return (
    <ModalShell
      title="Añadir comentario del repaso"
      subtitle="Es opcional. Úsalo para dejar constancia de qué ha fallado, qué ya tienes claro o qué quieres recordar la próxima vez."
      label="REPASO COMPLETADO"
      onClose={onClose}
    >
      <div className="study-completion-summary">
        <span className={`study-result ${assessment}`}>
          {labels[assessment]}
        </span>
        <div>
          <strong>{node?.name ?? "Repaso"}</strong>
          {node && <small>{studyNodePath(nodes, node.id).join(" · ")}</small>}
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(note);
        }}
      >
        <label>
          Comentario del repaso
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ej. Ya recuerdo la iniciativa de 1/4, pero sigo confundiendo la mayoría absoluta."
          />
        </label>
        <div className="study-completion-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Sin comentario
          </button>
          <button className="primary-button" type="submit">
            Guardar comentario
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function StudyTaskEditModal({
  task,
  nodes,
  onClose,
  onSave,
  onDelete,
}: {
  task: StudyTask;
  nodes: StudyNode[];
  onClose: () => void;
  onSave: (input: {
    id: string;
    nodeId: string;
    plannedFor: string;
    note: string;
    reason: string;
  }) => void;
  onDelete: (taskId: string) => void;
}) {
  const ordered = useMemo(() => flattenStudyTree(nodes), [nodes]);
  const [nodeId, setNodeId] = useState(
    nodes.some((node) => node.id === task.nodeId) ? task.nodeId : "",
  );
  const [plannedFor, setPlannedFor] = useState(task.plannedFor || "");
  const [note, setNote] = useState(task.note || "");
  const [reason, setReason] = useState(task.reason || "");
  const selected = nodes.find((node) => node.id === nodeId) ?? null;
  return (
    <ModalShell
      title="Editar repaso"
      subtitle="Cambia la fecha, la nota, el motivo o el elemento del temario sin crear un repaso nuevo."
      label="EDITAR PENDIENTE"
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (nodeId) onSave({ id: task.id, nodeId, plannedFor, note, reason });
        }}
      >
        <label>
          Elemento del temario
          <select
            value={nodeId}
            onChange={(event) => setNodeId(event.target.value)}
          >
            <option value="" disabled>
              Selecciona tema, apartado o artículo…
            </option>
            {ordered.map((node) => (
              <option
                key={node.id}
                value={node.id}
              >{`${"↳ ".repeat(Math.min(studyNodeDepth(nodes, node.id), 4))}${node.name}`}</option>
            ))}
          </select>
        </label>
        {selected && (
          <p className="study-selected-path">
            {studyNodePath(nodes, selected.id).join(" › ")}
          </p>
        )}
        <fieldset>
          <legend>Cuándo</legend>
          <div className="study-date-presets">
            <button
              type="button"
              className={plannedFor === localDateKey() ? "active" : ""}
              onClick={() => setPlannedFor(localDateKey())}
            >
              Hoy
            </button>
            <button
              type="button"
              className={plannedFor === addDaysKey(1) ? "active" : ""}
              onClick={() => setPlannedFor(addDaysKey(1))}
            >
              Mañana
            </button>
            <button
              type="button"
              className={plannedFor === addDaysKey(3) ? "active" : ""}
              onClick={() => setPlannedFor(addDaysKey(3))}
            >
              +3 días
            </button>
            <button
              type="button"
              className={plannedFor === addDaysKey(7) ? "active" : ""}
              onClick={() => setPlannedFor(addDaysKey(7))}
            >
              +7 días
            </button>
          </div>
        </fieldset>
        <label>
          Fecha
          <input
            type="date"
            value={plannedFor}
            onChange={(event) => setPlannedFor(event.target.value)}
          />
        </label>
        <label>
          Motivo <small>(opcional)</small>
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            <option value="">Sin indicar</option>
            <option value="estudio">Estudio planificado</option>
            <option value="olvido">Olvido</option>
            <option value="confusion">Confusión</option>
            <option value="literalidad">Literalidad</option>
            <option value="plazo_cifra">Plazo / cifra</option>
            <option value="afianzar">Quiero afianzarlo</option>
          </select>
        </label>
        <label>
          Nota <small>(opcional)</small>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Qué quieres recordar o revisar"
          />
        </label>
        <div className="study-edit-task-actions">
          <button
            type="button"
            className="danger-button"
            onClick={() => onDelete(task.id)}
          >
            Eliminar
          </button>
          <button className="primary-button" disabled={!nodeId}>
            Guardar cambios
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function StudyNodeEditorModal({
  nodes,
  nodeId,
  defaultParentId,
  onClose,
  onSave,
}: {
  nodes: StudyNode[];
  nodeId: string | null;
  defaultParentId: string | null;
  onClose: () => void;
  onSave: (input: {
    id: string | null;
    name: string;
    parentId: string | null;
  }) => void;
}) {
  const editing = nodeId
    ? (nodes.find((node) => node.id === nodeId) ?? null)
    : null;
  const blockedParents = editing
    ? studyDescendantIds(nodes, editing.id)
    : new Set<string>();
  const ordered = useMemo(() => flattenStudyTree(nodes), [nodes]);
  const initialParent =
    editing?.parentId ??
    (defaultParentId && nodes.some((node) => node.id === defaultParentId)
      ? defaultParentId
      : null);
  const [name, setName] = useState(editing?.name ?? "");
  const [parentId, setParentId] = useState(initialParent ?? "");
  const resolvedParentId = parentId || null;
  const duplicate =
    Boolean(name.trim()) &&
    nodes.some(
      (node) =>
        node.id !== nodeId &&
        node.parentId === resolvedParentId &&
        normalizeStudyLabel(node.name) === normalizeStudyLabel(name),
    );
  const selectedParent = resolvedParentId
    ? (nodes.find((node) => node.id === resolvedParentId) ?? null)
    : null;
  return (
    <ModalShell
      title={
        editing ? "Editar elemento del temario" : "Añadir elemento al temario"
      }
      subtitle={
        editing
          ? "Puedes cambiar el nombre o mover este elemento a otra rama. Su historial de repaso se conserva."
          : "Ponle el nombre que quieras y decide exactamente en qué parte del árbol debe aparecer."
      }
      label={editing ? "EDITAR TEMARIO" : "NUEVO ELEMENTO"}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && !duplicate)
            onSave({ id: nodeId, name, parentId: resolvedParentId });
        }}
      >
        <label>
          Nombre
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Artículo 103, Título V, Tema 2…"
          />
        </label>
        <label>
          Ubicación
          <select
            aria-label="Ubicación"
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
          >
            <option value="">Nivel principal · crear como tema raíz</option>
            {ordered
              .filter((node) => !blockedParents.has(node.id))
              .map((node) => (
                <option
                  key={node.id}
                  value={node.id}
                >{`${"↳ ".repeat(Math.min(studyNodeDepth(nodes, node.id), 4))}${node.name}`}</option>
              ))}
          </select>
        </label>
        {selectedParent && (
          <p className="study-selected-path">
            Se guardará dentro de:{" "}
            {studyNodePath(nodes, selectedParent.id).join(" › ")}
          </p>
        )}
        {duplicate && (
          <p className="form-error">
            Ya existe un elemento con ese nombre dentro de esa misma rama.
          </p>
        )}
        {editing && (
          <p className="study-editor-note">
            Mover o renombrar este elemento no elimina sus repasos, notas ni
            historial.
          </p>
        )}
        <button
          className="primary-button full"
          disabled={!name.trim() || duplicate}
        >
          {editing ? "Guardar cambios" : "Añadir al temario"}
        </button>
      </form>
    </ModalShell>
  );
}

export function StudyImportModal({
  nodes,
  defaultParentId,
  onClose,
  onImport,
}: {
  nodes: StudyNode[];
  defaultParentId: string | null;
  onClose: () => void;
  onImport: (roots: StudyImportNode[], parentId: string | null) => void;
}) {
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);

  const studyPrompt = buildStudyTreePrompt();

  async function copyStudyPrompt() {
    try {
      await navigator.clipboard.writeText(studyPrompt);
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 1800);
    } catch {
      setPromptCopied(false);
    }
  }

  const ordered = useMemo(() => flattenStudyTree(nodes), [nodes]);
  const [parentId, setParentId] = useState(
    defaultParentId && nodes.some((node) => node.id === defaultParentId)
      ? defaultParentId
      : "",
  );
  const parsed = useMemo(() => parseStudyTextTree(raw), [raw]);
  const total = countStudyImportNodes(parsed);
  const selectedParent = parentId
    ? (nodes.find((node) => node.id === parentId) ?? null)
    : null;
  async function loadFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    setRaw(await file.text());
  }
  return (
    <BottomSheet
      title={
        selectedParent
          ? `Importar dentro de ${selectedParent.name}`
          : "Importar temario"
      }
      subtitle="Se añaden los apartados nuevos sin borrar el historial existente."
      onClose={onClose}
      fullScreen
      className="study-import-editor"
    >
      <section className="import-step">
        <div className="import-step-head">
          <span>AI</span>
          <div>
            <strong>Crear temario con ChatGPT</strong>
            <small>
              Copia el prompt, adjunta o pega tu temario en ChatGPT y vuelve
              con el JSON generado.
            </small>
          </div>
        </div>

        <button
          type="button"
          className="secondary-button full-width"
          onClick={copyStudyPrompt}
        >
          {promptCopied ? "✓ Prompt copiado" : "Copiar prompt para ChatGPT"}
        </button>

        <details>
          <summary>Ver prompt completo</summary>
          <pre className="prompt-preview">{studyPrompt}</pre>
        </details>
      </section>

      <label>
        Destino
        <select
          value={parentId}
          onChange={(event) => setParentId(event.target.value)}
        >
          <option value="">Nivel principal · temas raíz</option>
          {ordered.map((node) => (
            <option
              key={node.id}
              value={node.id}
            >{`${"↳ ".repeat(Math.min(studyNodeDepth(nodes, node.id), 4))}${node.name}`}</option>
          ))}
        </select>
      </label>
      {selectedParent && (
        <p className="study-selected-path">
          Los elementos de nivel superior que pegues se añadirán dentro de:{" "}
          {studyNodePath(nodes, selectedParent.id).join(" › ")}
        </p>
      )}
      <label className="study-import-file">
        <input
          type="file"
          accept=".json,.txt,application/json,text/plain"
          onChange={(event) => loadFile(event.target.files?.[0] ?? null)}
        />
        <span>⇧</span>
        <strong>{fileName || "Cargar archivo .json o .txt"}</strong>
      </label>
      <div className="study-import-or">
        <span>o pega el contenido</span>
      </div>
      <textarea
        className="study-import-textarea"
        value={raw}
        onChange={(event) => {
          setRaw(event.target.value);
          setFileName("");
        }}
        placeholder={
          selectedParent
            ? "Artículo 103\nArtículo 104\nArtículo 105"
            : "Constitución Española\nTítulo IV. Gobierno y Administración\nArtículo 97\nArtículo 98\nArtículo 102\n  - Responsabilidad criminal"
        }
      />
      <details className="study-import-help">
        <summary>Formato JSON compatible</summary>
        <pre>{`{
  "nombre": "Constitución Española",
  "hijos": [
    {
      "nombre": "Título IV",
      "hijos": [
        { "nombre": "Artículo 102", "hijos": [] }
      ]
    }
  ]
}`}</pre>
      </details>
      <div className={`study-import-preview ${total ? "ready" : ""}`}>
        <div>
          <span className="section-label">PREVISUALIZACIÓN</span>
          <strong>
            {total
              ? `${total} elementos detectados`
              : "Pega o carga un temario"}
          </strong>
          <small>
            {selectedParent
              ? `Destino: ${selectedParent.name}`
              : "Destino: nivel principal"}
          </small>
        </div>
        {parsed.length > 0 && (
          <div className="study-import-root-chips">
            {parsed.slice(0, 6).map((node, index) => (
              <span key={`${node.name}-${index}`}>{node.name}</span>
            ))}
            {parsed.length > 6 && <span>+{parsed.length - 6}</span>}
          </div>
        )}
      </div>
      <div className="study-import-actions">
        <button className="secondary-button" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="primary-button"
          disabled={!total}
          onClick={() => onImport(parsed, parentId || null)}
        >
          Importar / actualizar
        </button>
      </div>
    </BottomSheet>
  );
}
