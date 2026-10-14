"use client";
import HierarchyField from "../filters/HierarchyPicker";
import { branchIds } from "../../lib/study/selection";
import { useMemo, useState } from "react";
import type { Card, Folder, StudyNode } from "../../lib/study/legacy";
import { flattenStudyTree, studyNodePath } from "../../lib/study/legacy";
import {
  libraryDraft,
  moveDraft,
  materializeLibraryDraft,
  type LibraryDraftNode,
} from "../../lib/study/libraryBridge";
import BottomSheet from "../sheets/BottomSheet";
import Icon from "../shared/Icon";
export default function LibraryToStudySheet({
  folders,
  cards,
  nodes,
  rootId,
  onClose,
  onConfirm,
}: {
  folders: Folder[];
  cards: Card[];
  nodes: StudyNode[];
  rootId?: string;
  onClose: () => void;
  onConfirm: (
    draft: LibraryDraftNode[],
    destination: string | null,
  ) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(() =>
      libraryDraft(folders, cards, rootId),
    ),
    [destination, setDestination] = useState(""),
    [menu, setMenu] = useState<string | null>(null),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const picked = draft.filter((n) => n.selected),
    target = draft.find((n) => n.id === menu);
  const tree = useMemo(() => {
    try {
      return materializeLibraryDraft(
        nodes,
        draft,
        destination || null,
        (() => {
          let i = 0;
          return () => "preview-new-" + ++i;
        })(),
        "1970-01-01",
      );
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [nodes, draft, destination]);
  const depth = (n: LibraryDraftNode) => {
    let p = n.parentId,
      count = 0,
      seen = new Set([n.id]);
    while (p && !seen.has(p)) {
      seen.add(p);
      count++;
      p = draft.find((d) => d.id === p)?.parentId ?? null;
    }
    return count;
  };
  const setParent = (id: string, parent: string | null) => {
    try {
      setDraft(moveDraft(draft, id, parent));
      setMenu(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <BottomSheet
      title="Biblioteca → Temario"
      subtitle="Crea la estructura sin volver a escribirla. Las tarjetas se enlazan: no se duplican."
      fullScreen
      onClose={onClose}
      dismissible={!busy}
      className="library-bridge-v12"
    >
      <label>
        Destino
        <HierarchyField
          label="Destino en el temario"
          items={nodes}
          value={destination}
          onChange={setDestination}
          rootLabel="Mi temario · nivel principal"
        />
      </label>
      {!preview ? (
        <>
          <p className="bridge-help">
            Selecciona lo que quieres incorporar. Toca un nombre para editarlo;
            usa ··· para cambiar su nivel.
          </p>
          <div className="bridge-draft">
            {draft.map((n) => (
              <div
                className="bridge-draft-row"
                key={n.id}
                style={{ paddingLeft: Math.min(depth(n), 3) * 14 }}
              >
                <input
                  type="checkbox"
                  checked={n.selected}
                  aria-label={`Incluir ${n.name}`}
                  onChange={(e) =>
                    setDraft((d) =>
                      d.map((x) =>
                        x.id === n.id
                          ? { ...x, selected: e.target.checked }
                          : x,
                      ),
                    )
                  }
                />
                <input
                  aria-label={`Nombre de ${n.name}`}
                  value={n.name}
                  onChange={(e) =>
                    setDraft((d) =>
                      d.map((x) =>
                        x.id === n.id ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
                <button
                  className="icon-button"
                  aria-label={`Jerarquía de ${n.name}`}
                  onClick={() => setMenu(n.id)}
                >
                  <Icon name="more" size={20} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="primary-button full"
            disabled={!picked.length || "error" in tree}
            onClick={() => setPreview(true)}
          >
            Previsualizar {picked.length} elementos{" "}
            <Icon name="arrow" size={18} />
          </button>
        </>
      ) : (
        <>
          <div className="bridge-preview">
            <span className="ux-label">ASÍ QUEDARÁ</span>
            {"nodes" in tree &&
              picked.map((n) => {
                const result = tree.nodes.find(
                  (x) => x.sourceKey === n.sourceKey,
                );
                return result ? (
                  <div className="bridge-preview-row" key={n.id}>
                    <Icon name="study" size={18} />
                    <span>
                      <strong>{result.name}</strong>
                      <small>
                        {studyNodePath(tree.nodes, result.id)
                          .slice(0, -1)
                          .join(" › ") || "Mi temario"}
                      </small>
                    </span>
                  </div>
                ) : null;
              })}
          </div>
          {"nodes" in tree && (
            <p className="bridge-help">
              {tree.created} nuevos · {tree.updated} existentes enlazados que se
              actualizarán. Tu historial y los demás elementos se conservan.
            </p>
          )}
          <button
            className="primary-button full"
            disabled={busy || "error" in tree}
            onClick={async () => {
              setBusy(true);
              try {
                const ok = await onConfirm(draft, destination || null);
                if (ok) onClose();
                else
                  setError(
                    "No se ha podido guardar. Puedes volver a intentarlo.",
                  );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Guardando…" : "Confirmar importación"}
          </button>
          <button
            className="ux-link"
            disabled={busy}
            onClick={() => setPreview(false)}
          >
            Volver a editar
          </button>
        </>
      )}
      {("error" in tree || error) && (
        <p role="alert" className="form-error">
          {error || ("error" in tree ? tree.error : "")}
        </p>
      )}
      {target && (
        <BottomSheet
          title={`Mover ${target.name}`}
          onClose={() => setMenu(null)}
        >
          <label>
            Dentro de
            <HierarchyField
              label="Nuevo padre del elemento"
              items={draft}
              value={target.parentId ?? ""}
              onChange={(id: string) => setParent(target.id, id || null)}
              blocked={branchIds(draft, [target.id])}
              rootLabel="Nivel principal de esta importación"
            />
          </label>
          <button
            className="sheet-action"
            onClick={() =>
              setParent(
                target.id,
                target.parentId
                  ? (draft.find((n) => n.id === target.parentId)?.parentId ??
                      null)
                  : null,
              )
            }
          >
            Sacar un nivel
          </button>
          <button
            className="sheet-action"
            onClick={() => {
              setDraft((d) =>
                d.map((n) =>
                  n.id === target.id ? { ...n, selected: false } : n,
                ),
              );
              setMenu(null);
            }}
          >
            No importar este elemento
          </button>
        </BottomSheet>
      )}
    </BottomSheet>
  );
}
