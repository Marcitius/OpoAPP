import type { Card, Folder, StudyNode } from "./legacy";
import { orderedChildren, moveBranch } from "./hierarchy";

export interface LibraryDraftNode {
  id: string;
  name: string;
  parentId: string | null;
  selected: boolean;
  sourceKey: string;
  sourceFolderId?: string;
  sourceCardIds?: string[];
  sortOrder?: number;
}
export function libraryDraft(
  folders: Folder[],
  cards: Card[],
  rootId?: string,
  articles = true,
): LibraryDraftNode[] {
  const result: LibraryDraftNode[] = [];
  const walk = (folder: Folder, parentId: string | null) => {
    const id = "draft-folder:" + folder.id;
    result.push({
      id,
      name: folder.name,
      parentId,
      selected: true,
      sourceKey: "folder:" + folder.id,
      sourceFolderId: folder.id,
    });
    orderedChildren(folders, folder.id).forEach((child) => walk(child, id));
    if (articles) {
      const groups = new Map<string, string[]>();
      cards
        .filter((c) => c.folderId === folder.id)
        .forEach((card) => {
          const text = card.front
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .trim();
          const match = text.match(/^art(?:í|i)culo\s+(\d+(?:\.\d+)?)/i);
          if (match) {
            const key = match[1];
            groups.set(key, [...(groups.get(key) ?? []), card.id]);
          }
        });
      groups.forEach((ids, number) =>
        result.push({
          id: `draft-article:${folder.id}:${number}`,
          name: "Artículo " + number,
          parentId: id,
          selected: true,
          sourceKey: `article:${folder.id}:${number}`,
          sourceCardIds: ids,
        }),
      );
    }
  };
  (rootId
    ? folders.filter((f) => f.id === rootId)
    : orderedChildren(folders, null)
  ).forEach((f) => walk(f, null));
  return result;
}
export function moveDraft(
  nodes: LibraryDraftNode[],
  id: string,
  parent: string | null,
) {
  return moveBranch(nodes, id, parent);
}
export function materializeLibraryDraft(
  existing: StudyNode[],
  draft: LibraryDraftNode[],
  destination: string | null,
  createId: () => string,
  stamp: string,
): { nodes: StudyNode[]; created: number; updated: number } {
  if (destination && !existing.some((n) => n.id === destination))
    throw new Error("El destino ya no existe.");
  const chosen = draft.filter((n) => n.selected);
  if (!chosen.length) throw new Error("Selecciona algún elemento.");
  if (chosen.some((n) => !n.name.trim()))
    throw new Error("Todos los elementos necesitan un nombre.");
  const ids = new Map<string, string>(),
    used = new Set(existing.map((n) => n.id));
  let created = 0,
    updated = 0;
  chosen.forEach((n) => {
    const found = existing.find(
      (e) =>
        e.sourceKey === n.sourceKey ||
        (n.sourceFolderId && e.sourceFolderId === n.sourceFolderId),
    );
    let id = found?.id;
    if (!id) {
      do {
        id = createId();
      } while (used.has(id));
      used.add(id);
      created++;
    } else updated++;
    ids.set(n.id, id);
  });
  let next = [...existing];
  const ranks = new Map<string | null, number>();
  chosen.forEach((n) => {
    let parent = n.parentId;
    const visited = new Set([n.id]);
    while (parent && !ids.has(parent)) {
      if (visited.has(parent))
        throw new Error("La estructura contiene un ciclo.");
      visited.add(parent);
      parent = draft.find((p) => p.id === parent)?.parentId ?? null;
    }
    const parentId = parent ? ids.get(parent)! : destination,
      id = ids.get(n.id)!;
    if (parentId === id)
      throw new Error("No puedes importar una rama dentro de sí misma.");
    const rank =
      ranks.get(parentId) ??
      Math.max(
        -1,
        ...orderedChildren(next, parentId).map(
          (e) => e.sortOrder ?? next.indexOf(e),
        ),
      ) + 1;
    ranks.set(parentId, rank + 1);
    const old = next.find((e) => e.id === id);
    const node: StudyNode = {
      ...old,
      id,
      name: n.name.trim(),
      parentId,
      createdAt: old?.createdAt ?? stamp,
      sortOrder: rank,
      sourceKey: n.sourceKey,
      ...(n.sourceFolderId ? { sourceFolderId: n.sourceFolderId } : {}),
      ...(n.sourceCardIds ? { sourceCardIds: [...n.sourceCardIds] } : {}),
    };
    next = old ? next.map((e) => (e.id === id ? node : e)) : [...next, node];
  });
  for (const n of next) {
    const seen = new Set([n.id]);
    let parent = n.parentId;
    while (parent) {
      if (seen.has(parent))
        throw new Error("El destino crearía un ciclo. Elige otra ubicación.");
      seen.add(parent);
      parent = next.find((p) => p.id === parent)?.parentId ?? null;
    }
  }
  return { nodes: next, created, updated };
}
