"use client";
import { useState } from "react";
import type { AppState } from "../../lib/study/legacy";
import { readValue, writeValue } from "../../lib/data/local";
import {
  materialNodes,
  materialHtml,
  nodeKey,
  createMaterial,
  copyLibraryStructure,
  deleteMaterial,
  moveMaterial,
  reorderMaterial,
  writeNodes,
  saveMaterial,
  searchMaterials,
  type MaterialNode,
} from "../../lib/material/model";
import { orderedChildren } from "../../lib/study/hierarchy";
import { branchIds, hierarchyPath } from "../../lib/study/selection";
import BottomSheet from "../sheets/BottomSheet";
import { HierarchyPicker } from "../filters/HierarchyPicker";
import MaterialDocument, { type SaveResult } from "./MaterialDocument";
import Icon from "../shared/Icon";
export default function MaterialPage({
  state,
  user,
  status,
  onUpdate,
  onSave,
}: {
  state: AppState;
  user: string;
  status: string;
  onUpdate: (fn: (s: AppState) => AppState) => Promise<boolean>;
  onSave: (id: string, html: string, expected: string) => Promise<SaveResult>;
}) {
  const [parent, setParent] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [opened, setOpened] = useState<string | null>(null),
    [form, setForm] = useState<"new" | "rename" | null>(null),
    [name, setName] = useState(""),
    [action, setAction] = useState<MaterialNode | null>(null),
    [moving, setMoving] = useState(false),
    [target, setTarget] = useState<string | null>(null),
    [copy, setCopy] = useState(false),
    [roots, setRoots] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const nodes = materialNodes(state.settings),
    current = nodes.find((n) => n.id === parent),
    doc = nodes.find((n) => n.id === opened),
    shown = query.trim()
      ? searchMaterials(state, query)
      : orderedChildren(nodes, current?.id ?? null);
  async function update(fn: (s: AppState) => AppState) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      return await onUpdate(fn);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const create = () => {
    setName("");
    setAction(null);
    setForm("new");
  };
  return (
    <section className="ux-page material-page">
      <p className="ux-intro">
        Tu temario, escrito a tu manera. Cada tema y apartado puede tener su
        propio documento.
      </p>
      <div className="material-browser-actions">
        <button className="primary-button" onClick={create}>
          + {current ? "Nuevo subapartado" : "Nuevo tema"}
        </button>
        <button
          className="secondary-button"
          onClick={() => {
            setRoots([]);
            setCopy(true);
          }}
        >
          Copiar estructura de Biblioteca
        </button>
      </div>
      <div className="ux-search">
        <Icon name="search" />
        <input
          aria-label="Buscar material de estudio"
          placeholder="Buscar temas o dentro del contenido…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="picker-location">
        <button
          className="ux-link"
          disabled={!parent && !query}
          onClick={() =>
            query ? setQuery("") : setParent(current?.parentId ?? null)
          }
        >
          <Icon name="back" />
          Atrás
        </button>
        <span>
          {current
            ? hierarchyPath(nodes, current.id)
                .map((n) => n.name)
                .join(" › ")
            : "Todo el material"}
        </span>
      </div>
      {current && (
        <button
          className="material-current-document"
          onClick={() => setOpened(current.id)}
        >
          <Icon name="study" />
          <span>
            <strong>Contenido de {current.name}</strong>
            <small>
              {materialHtml(state.settings, current.id)
                ? "Abrir y editar documento"
                : "Añadir contenido a este tema"}
            </small>
          </span>
          <Icon name="chevron" />
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="simple-list">
        {shown.map((n) => (
          <div key={n.id} className="material-node-row">
            <button
              className="material-node-main"
              onClick={() => {
                setParent(n.id);
                setQuery("");
              }}
            >
              <Icon name="folder" />
              <span>
                <strong>{n.name}</strong>
                <small>
                  {query
                    ? hierarchyPath(nodes, n.id)
                        .slice(0, -1)
                        .map((p) => p.name)
                        .join(" › ")
                    : `${nodes.filter((c) => c.parentId === n.id).length} subapartados${materialHtml(state.settings, n.id) ? " · Con contenido" : ""}`}
                </small>
              </span>
              <Icon name="chevron" />
            </button>
            <button
              className="ux-link"
              aria-label={`Abrir contenido de ${n.name}`}
              onClick={() => setOpened(n.id)}
            >
              Leer
            </button>
            <button
              className="icon-button"
              aria-label={`Acciones de material ${n.name}`}
              onClick={() => setAction(n)}
            >
              <Icon name="more" />
            </button>
          </div>
        ))}
      </div>
      {!shown.length && (
        <div className="empty-inline">
          {query
            ? "No hay coincidencias."
            : current
              ? "Todavía no hay subapartados. Puedes escribir aquí o dividir el contenido."
              : "Crea un tema o copia la estructura de Biblioteca. Después pega o escribe tu contenido con formato."}
        </div>
      )}
      {action && !form && !moving && (
        <BottomSheet title={action.name} onClose={() => setAction(null)}>
          <button
            className="sheet-action"
            onClick={() => {
              setOpened(action.id);
              setAction(null);
            }}
          >
            Leer / editar contenido
          </button>
          <button
            className="sheet-action"
            onClick={() => {
              setName(action.name);
              setForm("rename");
            }}
          >
            Cambiar nombre
          </button>
          <button
            className="sheet-action"
            onClick={() => {
              setTarget(action.parentId);
              setMoving(true);
            }}
          >
            Mover a…
          </button>
          <button
            className="sheet-action"
            disabled={busy}
            onClick={async () => {
              if (
                await update((s) =>
                  reorderMaterial(s, action.id, -1, new Date().toISOString()),
                )
              )
                setAction(null);
            }}
          >
            Mover arriba
          </button>
          <button
            className="sheet-action"
            disabled={busy}
            onClick={async () => {
              if (
                await update((s) =>
                  reorderMaterial(s, action.id, 1, new Date().toISOString()),
                )
              )
                setAction(null);
            }}
          >
            Mover abajo
          </button>
          <button
            className="sheet-action"
            disabled={busy || !action.parentId}
            onClick={async () => {
              const p = nodes.find((n) => n.id === action.parentId);
              if (
                await update((s) =>
                  moveMaterial(
                    s,
                    [action.id],
                    p?.parentId ?? null,
                    new Date().toISOString(),
                  ),
                )
              )
                setAction(null);
            }}
          >
            Subir un nivel
          </button>
          <button
            className="sheet-action danger"
            disabled={busy}
            onClick={async () => {
              if (
                !confirm(
                  "¿Eliminar este apartado, sus documentos y subapartados?",
                )
              )
                return;
              if (
                await update((s) =>
                  deleteMaterial(s, action.id, new Date().toISOString()),
                )
              )
                setAction(null);
            }}
          >
            Eliminar rama
          </button>
        </BottomSheet>
      )}
      {form && (
        <BottomSheet
          title={
            form === "new"
              ? "Nuevo apartado de material"
              : "Cambiar nombre del apartado"
          }
          onClose={() => {
            setForm(null);
            setAction(null);
          }}
          dismissible={!busy}
        >
          <label>
            Nombre
            <input
              aria-label="Nombre del apartado"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Por ejemplo, Ley 39/2015"
            />
          </label>
          <button
            className="primary-button full"
            disabled={!name.trim() || busy}
            onClick={async () => {
              const id = crypto.randomUUID(),
                stamp = new Date().toISOString();
              const ok = await update((s) =>
                form === "new"
                  ? createMaterial(s, id, name, current?.id ?? null, stamp)
                  : writeNodes(
                      s,
                      materialNodes(s.settings)
                        .filter((n) => n.id === action?.id)
                        .map((n) => ({
                          ...n,
                          name: name.trim(),
                          updatedAt: stamp,
                        })),
                    ),
              );
              if (ok) {
                setForm(null);
                setAction(null);
              }
            }}
          >
            Guardar apartado
          </button>
        </BottomSheet>
      )}
      {moving && action && (
        <BottomSheet
          title="Mover material de estudio"
          onClose={() => {
            setMoving(false);
            setAction(null);
          }}
          dismissible={!busy}
        >
          <HierarchyPicker
            items={nodes}
            blocked={branchIds(nodes, [action.id])}
            value={target ? [target] : []}
            onChange={(ids) => setTarget(ids[0] ?? null)}
            rootLabel="Nivel principal"
          />
          <button
            className="primary-button full"
            disabled={busy}
            onClick={async () => {
              if (
                await update((s) =>
                  moveMaterial(
                    s,
                    [action.id],
                    target,
                    new Date().toISOString(),
                  ),
                )
              ) {
                setMoving(false);
                setAction(null);
              }
            }}
          >
            Mover apartado y subapartados
          </button>
        </BottomSheet>
      )}
      {copy && (
        <BottomSheet
          title="Copiar estructura de Biblioteca"
          onClose={() => setCopy(false)}
          dismissible={!busy}
        >
          <p>
            Se crearán estos temas y subtemas como apartados vacíos en{" "}
            {current?.name ?? "el nivel principal"}. Las tarjetas y sus repasos
            permanecen en Biblioteca. No se duplican ramas ya copiadas.
          </p>
          <HierarchyPicker
            items={state.folders}
            value={roots}
            onChange={setRoots}
            multiple
            rootLabel="Toda la Biblioteca"
          />
          <div
            className="material-copy-preview"
            aria-label="Vista previa de la estructura"
          >
            {state.folders
              .filter(
                (f) =>
                  !roots.length || branchIds(state.folders, roots).has(f.id),
              )
              .map((f) => (
                <p key={f.id}>
                  {hierarchyPath(state.folders, f.id)
                    .map((n) => n.name)
                    .join(" › ")}
                </p>
              ))}
          </div>
          <button
            className="primary-button full"
            disabled={busy || !state.folders.length}
            onClick={async () => {
              if (
                await update((s) =>
                  copyLibraryStructure(
                    s,
                    roots,
                    current?.id ?? null,
                    new Date().toISOString(),
                  ),
                )
              )
                setCopy(false);
            }}
          >
            Crear estructura de material
          </button>
        </BottomSheet>
      )}
      {doc && (
        <MaterialDocument
          key={doc.id}
          user={user}
          node={doc}
          html={materialHtml(state.settings, doc.id)}
          status={status}
          onClose={() => setOpened(null)}
          onSave={(html, expected) => onSave(doc.id, html, expected)}
          onCopy={async (html) => {
            const id = crypto.randomUUID(),
              stamp = new Date().toISOString();
            return update((s) =>
              saveMaterial(
                createMaterial(
                  s,
                  id,
                  doc.name + " (copia)",
                  doc.parentId,
                  stamp,
                ),
                id,
                html,
                "",
                stamp,
              ),
            );
          }}
        />
      )}
      {opened && !doc && (
        <BottomSheet
          title="El apartado ya no está disponible"
          onClose={() => setOpened(null)}
        >
          <p>
            Se ha eliminado desde otro dispositivo. Si estabas editando, el
            borrador local se conserva.
          </p>
          <button
            className="primary-button"
            onClick={async () => {
              const draft = await readValue<{ html: string }>(
                "legacy",
                "material-draft:" + user + ":" + opened,
              );
              const id = crypto.randomUUID(),
                stamp = new Date().toISOString(),
                text = draft?.html ?? materialHtml(state.settings, opened);
              const original =
                state.settings[nodeKey(opened)]?.name ?? "Material";
              if (
                await update((s) =>
                  saveMaterial(
                    createMaterial(
                      s,
                      id,
                      original + " (recuperado)",
                      null,
                      stamp,
                    ),
                    id,
                    text,
                    "",
                    stamp,
                  ),
                )
              ) {
                await writeValue(
                  "legacy",
                  "material-draft:" + user + ":" + opened,
                  null,
                );
                setOpened(id);
              }
            }}
          >
            Recuperar texto como nuevo apartado
          </button>
          <button className="ux-link" onClick={() => setOpened(null)}>
            Volver al material
          </button>
        </BottomSheet>
      )}
    </section>
  );
}
