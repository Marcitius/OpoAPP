import type { AppState } from "../study/legacy";
import {
  branchIds,
  hierarchyPath,
  moveBranches,
  searchText,
} from "../study/selection";
import { appendRank, reorderItems } from "../study/hierarchy";
export type MaterialNode = {
  version: 1;
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  sourceFolderId?: string;
  deleted?: boolean;
};
export const nodeKey = (id: string) => "studyMaterialNode:" + id;
export const contentKey = (id: string) => "studyMaterialContent:" + id;
export function materialNodes(settings: AppState["settings"]): MaterialNode[] {
  const nodes = Object.entries(settings)
    .filter(
      ([k, v]) =>
        k.startsWith("studyMaterialNode:") &&
        v?.version === 1 &&
        k === nodeKey(v.id) &&
        typeof v.name === "string" &&
        !v.deleted,
    )
    .map(([, v]) => ({ ...v })) as MaterialNode[];
  // Keep the projection navigable if two offline moves temporarily form a cycle.
  for (const n of nodes) {
    const seen = new Set([n.id]);
    let p = n.parentId;
    while (p) {
      if (seen.has(p)) {
        n.parentId = null;
        break;
      }
      seen.add(p);
      p = nodes.find((x) => x.id === p)?.parentId ?? null;
    }
    if (n.parentId && !nodes.some((x) => x.id === n.parentId))
      n.parentId = null;
  }
  return nodes;
}
export function materialHtml(
  settings: AppState["settings"],
  id: string,
): string {
  return typeof settings[contentKey(id)]?.html === "string"
    ? settings[contentKey(id)].html
    : "";
}
export function writeNodes(s: AppState, nodes: MaterialNode[]): AppState {
  return {
    ...s,
    settings: {
      ...s.settings,
      ...Object.fromEntries(nodes.map((n) => [nodeKey(n.id), n])),
    },
  };
}
export function createMaterial(
  s: AppState,
  id: string,
  name: string,
  parentId: string | null,
  stamp: string,
): AppState {
  if (!name.trim()) throw Error("Escribe un nombre.");
  if (s.settings[nodeKey(id)]) throw Error("Ese elemento ya existe.");
  const nodes = materialNodes(s.settings);
  if (parentId && !nodes.some((n) => n.id === parentId))
    throw Error("El destino ya no existe.");
  return writeNodes(s, [
    {
      version: 1,
      id,
      name: name.trim(),
      parentId,
      sortOrder: appendRank(nodes, parentId),
      createdAt: stamp,
      updatedAt: stamp,
    },
  ]);
}
export function moveMaterial(
  s: AppState,
  ids: string[],
  parent: string | null,
  stamp: string,
): AppState {
  const nodes = materialNodes(s.settings),
    next = moveBranches(nodes, ids, parent);
  return writeNodes(
    s,
    next
      .filter((n, i) => n !== nodes[i])
      .map((n) => ({ ...n, updatedAt: stamp })),
  );
}
export function reorderMaterial(
  s: AppState,
  id: string,
  direction: -1 | 1,
  stamp: string,
): AppState {
  const nodes = materialNodes(s.settings),
    next = reorderItems(nodes, id, direction);
  return writeNodes(
    s,
    next
      .filter((n, i) => n !== nodes[i])
      .map((n) => ({ ...n, updatedAt: stamp })),
  );
}
export function deleteMaterial(
  s: AppState,
  id: string,
  stamp: string,
): AppState {
  const nodes = materialNodes(s.settings),
    ids = branchIds(nodes, [id]);
  return writeNodes(
    s,
    nodes
      .filter((n) => ids.has(n.id))
      .map((n) => ({ ...n, deleted: true, updatedAt: stamp })),
  );
}
export function saveMaterial(
  s: AppState,
  id: string,
  html: string,
  expected: string,
  stamp: string,
): AppState {
  if (!materialNodes(s.settings).some((n) => n.id === id))
    throw Error("Este apartado se ha eliminado.");
  if (materialHtml(s.settings, id) !== expected)
    throw Error("material-conflict");
  return {
    ...s,
    settings: {
      ...s.settings,
      [contentKey(id)]: { version: 1, html, updatedAt: stamp },
    },
  };
}
// Copy only folders, retaining the user's card IDs/content/history untouched.
export function copyLibraryStructure(
  s: AppState,
  roots: string[],
  destination: string | null,
  stamp: string,
): AppState {
  const carried = roots.length
    ? branchIds(s.folders, roots)
    : new Set(s.folders.map((f) => f.id));
  const existing = materialNodes(s.settings),
    bySource = new Map(
      existing
        .filter((n) => n.sourceFolderId)
        .map((n) => [n.sourceFolderId!, n]),
    );
  if (destination && !existing.some((n) => n.id === destination))
    throw Error("El destino ya no existe.");
  const folders = s.folders
    .filter((f) => carried.has(f.id))
    .sort(
      (a, b) =>
        (a.sortOrder ?? s.folders.indexOf(a)) -
        (b.sortOrder ?? s.folders.indexOf(b)),
    );
  const map = new Map(
    folders.map((f) => [f.id, bySource.get(f.id)?.id ?? crypto.randomUUID()]),
  );
  const created = folders
    .filter((f) => !bySource.has(f.id))
    .map((f, i): MaterialNode => ({
      version: 1,
      id: map.get(f.id)!,
      name: f.name,
      parentId:
        f.parentId && map.has(f.parentId) ? map.get(f.parentId)! : destination,
      sortOrder: appendRank(existing, destination) + i,
      createdAt: stamp,
      updatedAt: stamp,
      sourceFolderId: f.id,
    }));
  return writeNodes(s, created);
}
export function searchMaterials(s: AppState, query: string): MaterialNode[] {
  const nodes = materialNodes(s.settings),
    needle = searchText(query);
  return nodes.filter((n) =>
    searchText(
      hierarchyPath(nodes, n.id)
        .map((x) => x.name)
        .join(" ") +
        " " +
        materialHtml(s.settings, n.id).replace(/<[^>]*>/g, " "),
    ).includes(needle),
  );
}
