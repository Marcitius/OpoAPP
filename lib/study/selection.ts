import type { AppState } from "./legacy";
import { appendRank, moveBranch, type HierarchyItem } from "./hierarchy";
import { cardsForStudyNode } from "./planning";
export const searchText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
export function branchIds<T extends HierarchyItem>(
  items: T[],
  roots: string[],
) {
  const ids = new Set(roots.filter((id) => items.some((n) => n.id === id)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of items)
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id);
        changed = true;
      }
  }
  return ids;
}
export function hierarchyPath<T extends HierarchyItem & { name: string }>(
  items: T[],
  id: string,
) {
  const map = new Map(items.map((n) => [n.id, n])),
    path: T[] = [],
    seen = new Set<string>();
  let n = map.get(id);
  while (n && !seen.has(n.id)) {
    seen.add(n.id);
    path.unshift(n);
    n = n.parentId ? map.get(n.parentId) : undefined;
  }
  return path;
}
export function selectionRoots<T extends HierarchyItem>(
  items: T[],
  ids: string[],
) {
  const selected = new Set(ids),
    map = new Map(items.map((n) => [n.id, n]));
  return items
    .filter((n) => selected.has(n.id))
    .filter((n) => {
      let p = n.parentId;
      const seen = new Set([n.id]);
      while (p && !seen.has(p)) {
        if (selected.has(p)) return false;
        seen.add(p);
        p = map.get(p)?.parentId;
      }
      return true;
    })
    .map((n) => n.id);
}
export function moveBranches<T extends HierarchyItem>(
  items: T[],
  ids: string[],
  target: string | null,
): T[] {
  const roots = selectionRoots(items, ids);
  if (target && !items.some((n) => n.id === target))
    throw new Error("No se encuentra el destino.");
  if (target && branchIds(items, roots).has(target))
    throw new Error("Elige un destino fuera de las ramas seleccionadas.");
  for (const id of roots) moveBranch(items, id, target);
  let next = items;
  for (const id of roots) next = moveBranch(next, id, target);
  return next;
}
export function moveLibrarySelection(
  s: AppState,
  folderIds: string[],
  cardIds: string[],
  target: string | null,
  newId: string,
  stamp: string,
): AppState {
  const carried = branchIds(s.folders, selectionRoots(s.folders, folderIds));
  let folders = moveBranches(s.folders, folderIds, target);
  const cards = s.cards.filter(
    (c) => cardIds.includes(c.id) && !carried.has(c.folderId),
  );
  let destination = target;
  if (cards.length && !destination) {
    let root = folders.find((f) => f.isUnfiled && !f.parentId);
    if (!root) {
      root = {
        id: newId,
        name: "Sin carpeta",
        parentId: null,
        color: "#285943",
        createdAt: stamp,
        isUnfiled: true,
        sortOrder: appendRank(folders, null),
      };
      folders = [...folders, root];
    }
    destination = root.id;
  }
  let order = appendRank(s.cards, destination, "folderId");
  const selected = new Set(cards.map((c) => c.id));
  return {
    ...s,
    folders,
    cards: s.cards.map((c) =>
      selected.has(c.id) && c.folderId !== destination
        ? { ...c, folderId: destination!, sortOrder: order++ }
        : c,
    ),
  };
}
export function scopedCards(s: AppState, folders: string[], nodes: string[]) {
  if (!folders.length && !nodes.length) return s.cards;
  const included = branchIds(s.folders, folders),
    linked = new Set<string>();
  for (const id of nodes)
    for (const c of cardsForStudyNode(s.studyNodes, s.folders, s.cards, id))
      linked.add(c.id);
  return s.cards.filter((c) => included.has(c.folderId) || linked.has(c.id));
}
export function scopedProgress(
  s: AppState,
  folders: string[],
  nodes: string[],
): AppState {
  if (!folders.length && !nodes.length) return s;
  const cards = scopedCards(s, folders, nodes),
    ids = new Set(cards.map((c) => c.id)),
    fs = branchIds(s.folders, folders);
  const relevant = nodes.length
    ? branchIds(s.studyNodes, nodes)
    : new Set(
        s.studyNodes
          .filter(
            (n) =>
              (n.sourceFolderId && fs.has(n.sourceFolderId)) ||
              n.sourceCardIds?.some((id) => ids.has(id)),
          )
          .map((n) => n.id),
      );
  const visible = new Set(relevant);
  for (const id of relevant)
    for (const n of hierarchyPath(s.studyNodes, id)) visible.add(n.id);
  return {
    ...s,
    cards,
    reviews: s.reviews.filter((r) => ids.has(r.cardId)),
    studyNodes: s.studyNodes.filter((n) => visible.has(n.id)),
    studyTasks: s.studyTasks.filter((t) => relevant.has(t.nodeId)),
  };
}
