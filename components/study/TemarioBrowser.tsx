"use client";
import { useEffect, useState } from "react";
import type { StudyNode, StudyTask } from "../../lib/study/legacy";
import { dateLabel, studyNodePath, localDateKey } from "../../lib/study/legacy";
import Icon from "../shared/Icon";
import BottomSheet from "../sheets/BottomSheet";
interface Props {
  nodes: StudyNode[];
  tasks: StudyTask[];
  onStudy: (id: string) => void;
  onQuick: (id?: string | null) => void;
  onExport: (id?: string) => void;
  onCreate: (parentId: string | null) => void;
  onEdit: (id: string) => void;
  onImport: (parentId: string | null) => void;
  onDelete: (ids: string[]) => void;
  onReorder: (id: string, direction: -1 | 1) => void;
}
export default function TemarioBrowser(p: Props) {
  const [parent, setParent] = useState<string | null>(null),
    [menu, setMenu] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [select, setSelect] = useState(false),
    [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    if (parent && !p.nodes.some((n) => n.id === parent)) setParent(null);
    setSelected((ids) => ids.filter((id) => p.nodes.some((n) => n.id === id)));
  }, [p.nodes, parent]);
  const current = p.nodes.find((n) => n.id === parent),
    target = p.nodes.find((n) => n.id === menu);
  const siblings = p.nodes
    .filter((n) => n.parentId === parent)
    .sort(
      (a, b) =>
        (a.sortOrder ?? p.nodes.indexOf(a)) -
        (b.sortOrder ?? p.nodes.indexOf(b)),
    );
  const shown = query.trim()
    ? p.nodes.filter((n) =>
        studyNodePath(p.nodes, n.id)
          .join(" ")
          .toLocaleLowerCase("es")
          .includes(query.trim().toLocaleLowerCase("es")),
      )
    : siblings;
  const scoped = p.tasks
    .filter((t) => t.nodeId === parent)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const recent = scoped.find((t) => t.status === "done"),
    pending = scoped.find((t) => t.status === "pending");
  const action = (fn: () => void) => {
    setMenu(null);
    fn();
  };
  return (
    <div className="temario-browser">
      <div className="temario-toolbar">
        <button
          className="ux-link"
          onClick={() => {
            setQuery("");
            if (select) {
              setSelect(false);
              setSelected([]);
            } else setParent(current?.parentId ?? null);
          }}
          disabled={!parent && !select}
        >
          <Icon name="back" size={18} />
          {select
            ? "Cancelar selección"
            : current?.parentId
              ? p.nodes.find((n) => n.id === current.parentId)?.name
              : "Mi temario"}
        </button>
        <div>
          <button
            className="icon-button"
            aria-label="Añadir elemento"
            onClick={() => p.onCreate(parent)}
          >
            <Icon name="plus" />
          </button>
          <button
            className="icon-button"
            aria-label="Opciones del temario"
            onClick={() => setMenu(parent ?? "root-menu")}
          >
            <Icon name="more" />
          </button>
        </div>
      </div>
      <div className="temario-location">
        <span className="ux-label">{parent ? "DENTRO DE" : "ORGANIZAR"}</span>
        <h2>{current?.name ?? "Mi temario"}</h2>
        {current && (
          <p>{studyNodePath(p.nodes, current.id).slice(0, -1).join(" › ")}</p>
        )}
      </div>
      <div className="ux-search">
        <Icon name="search" size={20} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en todo el temario"
          aria-label="Buscar temario"
        />
      </div>
      <div className="temario-split">
        <div className="temario-level simple-list">
          {select && (
            <div className="selection-summary">
              <strong>{selected.length} seleccionados</strong>
              <button
                className="danger-button"
                disabled={!selected.length}
                onClick={() => {
                  p.onDelete(selected);
                  setSelected([]);
                  setSelect(false);
                }}
              >
                Eliminar
              </button>
            </div>
          )}
          {shown.map((node) => {
            const children = p.nodes.filter((n) => n.parentId === node.id);
            const nodeTasks = p.tasks.filter((t) => t.nodeId === node.id);
            const latest = nodeTasks
              .filter((t) => t.status === "done")
              .sort((a, b) =>
                (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
              )[0];
            const next = nodeTasks.find((t) => t.status === "pending");
            return (
              <div className="temario-row" key={node.id}>
                <button
                  className="temario-row-main"
                  onClick={() => {
                    if (select)
                      setSelected((ids) =>
                        ids.includes(node.id)
                          ? ids.filter((x) => x !== node.id)
                          : [...ids, node.id],
                      );
                    else {
                      setParent(node.id);
                      setQuery("");
                    }
                  }}
                >
                  {select ? (
                    <span
                      className={`selection-check ${selected.includes(node.id) ? "selected" : ""}`}
                    >
                      {selected.includes(node.id) ? "✓" : ""}
                    </span>
                  ) : (
                    <span className="node-symbol">
                      <Icon
                        name={children.length ? "folder" : "study"}
                        size={21}
                      />
                    </span>
                  )}
                  <span>
                    <strong>{node.name}</strong>
                    <small>
                      {next
                        ? next.plannedFor <= localDateKey()
                          ? next.reason === "estudio"
                            ? "Estudio pendiente"
                            : "Repaso pendiente"
                          : `${next.reason === "estudio" ? "Estudio" : "Repaso"} ${dateLabel(next.plannedFor)}`
                        : latest
                          ? `${latest.assessment ?? "Estudiado"} · ${dateLabel(latest.completedAt)}`
                          : children.length
                            ? `${children.length} apartados`
                            : "Sin estudiar"}
                    </small>
                  </span>
                  <Icon name="chevron" size={18} />
                </button>
                {!select && (
                  <button
                    className="icon-button"
                    aria-label={`Acciones de ${node.name}`}
                    onClick={() => setMenu(node.id)}
                  >
                    <Icon name="more" />
                  </button>
                )}
              </div>
            );
          })}
          {!shown.length && (
            <p className="empty-inline">
              {query
                ? "No hay coincidencias."
                : current
                  ? "Este apartado no tiene subapartados."
                  : "Aún no hay temas. Importa o crea el primero."}
            </p>
          )}
        </div>
        {current && !select && (
          <aside className="temario-detail">
            <span className="ux-label">ESTE APARTADO</span>
            <h3>{current.name}</h3>
            {recent && (
              <span className={`assessment-chip ${recent.assessment}`}>
                Último: {recent.assessment ?? "Estudiado"}
              </span>
            )}
            {pending?.note && <p>{pending.note}</p>}
            {recent?.completionNote && (
              <p>
                <strong>Tu última nota</strong>
                <br />
                {recent.completionNote}
              </p>
            )}
            <button
              className="primary-button full"
              onClick={() => p.onStudy(current.id)}
            >
              Estudiar este apartado <Icon name="arrow" size={18} />
            </button>
            <button
              className="secondary-button full"
              onClick={() => p.onQuick(current.id)}
            >
              Añadir para repasar
            </button>
            <button className="ux-link" onClick={() => setMenu(current.id)}>
              Más acciones <Icon name="more" size={18} />
            </button>
          </aside>
        )}
      </div>
      {menu && (
        <BottomSheet
          title={target?.name ?? "Mi temario"}
          onClose={() => setMenu(null)}
          className="actions-sheet"
        >
          {target && (
            <>
              <button
                className="sheet-action"
                onClick={() => action(() => p.onStudy(target.id))}
              >
                <Icon name="study" />
                Estudiar ahora
              </button>
              <button
                className="sheet-action"
                onClick={() => action(() => p.onQuick(target.id))}
              >
                <Icon name="review" />
                Añadir repaso o nota
              </button>
              <hr />
              <button
                className="sheet-action"
                onClick={() => action(() => p.onEdit(target.id))}
              >
                Editar o mover
              </button>
              <button
                className="sheet-action"
                onClick={() => action(() => p.onReorder(target.id, -1))}
              >
                Subir en este nivel
              </button>
              <button
                className="sheet-action"
                onClick={() => action(() => p.onReorder(target.id, 1))}
              >
                Bajar en este nivel
              </button>
            </>
          )}
          <button
            className="sheet-action"
            onClick={() => action(() => p.onCreate(target?.id ?? null))}
          >
            <Icon name="plus" />
            Añadir {target ? "subapartado" : "tema"}
          </button>
          <button
            className="sheet-action"
            onClick={() => action(() => p.onImport(target?.id ?? null))}
          >
            <Icon name="upload" />
            Importar {target ? "dentro" : "temario"}
          </button>
          <button
            className="sheet-action"
            onClick={() => action(() => p.onExport(target?.id))}
          >
            <Icon name="download" />
            Exportar {target ? "esta rama" : "temario"}
          </button>
          <button
            className="sheet-action"
            onClick={() =>
              action(() => {
                setSelect(true);
                setSelected([]);
              })
            }
          >
            Seleccionar varios
          </button>
          {target && (
            <>
              <hr />
              <button
                className="sheet-action danger-text"
                onClick={() => action(() => p.onDelete([target.id]))}
              >
                Eliminar elemento y subapartados
              </button>
            </>
          )}
        </BottomSheet>
      )}
    </div>
  );
}
