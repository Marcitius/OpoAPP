export type HierarchyItem = {
  id: string;
  parentId?: string | null;
  folderId?: string;
  sortOrder?: number;
};
export function orderedChildren<T extends HierarchyItem>(
  items: T[],
  parent: string | null,
  parentField: "parentId" | "folderId" = "parentId",
): T[] {
  return items
    .filter((n) => (n[parentField] ?? null) === parent)
    .sort(
      (a, b) =>
        (a.sortOrder ?? items.indexOf(a)) - (b.sortOrder ?? items.indexOf(b)) ||
        items.indexOf(a) - items.indexOf(b),
    );
}
export function reorderItems<T extends HierarchyItem>(
  items: T[],
  id: string,
  direction: -1 | 1,
  parentField: "parentId" | "folderId" = "parentId",
): T[] {
  const node = items.find((n) => n.id === id);
  if (!node) return items;
  const siblings = orderedChildren(
      items,
      node[parentField] ?? null,
      parentField,
    ),
    index = siblings.findIndex((n) => n.id === id),
    to = index + direction;
  if (to < 0 || to >= siblings.length) return items;
  [siblings[index], siblings[to]] = [siblings[to], siblings[index]];
  const rank = new Map(siblings.map((n, i) => [n.id, i]));
  return items.map((n) =>
    rank.has(n.id) ? { ...n, sortOrder: rank.get(n.id) } : n,
  );
}
export function appendRank<T extends HierarchyItem>(
  items: T[],
  parent: string | null,
  parentField: "parentId" | "folderId" = "parentId",
) {
  return (
    Math.max(
      -1,
      ...orderedChildren(items, parent, parentField).map(
        (n) => n.sortOrder ?? items.indexOf(n),
      ),
    ) + 1
  );
}
export function moveBranch<T extends HierarchyItem>(
  items: T[],
  id: string,
  parent: string | null,
): T[] {
  const node = items.find((n) => n.id === id);
  if (!node) throw new Error("No se encuentra este elemento.");
  if (parent && !items.some((n) => n.id === parent))
    throw new Error("No se encuentra el destino.");
  let target = parent;
  const visited = new Set<string>([id]);
  while (target) {
    if (visited.has(target))
      throw new Error("No puedes mover una rama dentro de sí misma.");
    visited.add(target);
    target = items.find((n) => n.id === target)?.parentId ?? null;
  }
  if ((node.parentId ?? null) === parent) return items;
  const siblings = orderedChildren(items, parent);
  const rank =
    Math.max(-1, ...siblings.map((n) => n.sortOrder ?? items.indexOf(n))) + 1;
  return items.map((n) =>
    n.id === id ? { ...n, parentId: parent, sortOrder: rank } : n,
  );
}
export function moveOut<T extends HierarchyItem>(items: T[], id: string): T[] {
  const node = items.find((item) => item.id === id),
    parent = items.find((item) => item.id === node?.parentId);
  return moveBranch(items, id, parent?.parentId ?? null);
}
