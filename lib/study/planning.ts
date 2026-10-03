import type { StudyNode, StudyTask, Card, Folder } from "./legacy";
import {
  localDateKey,
  studyDescendantIds,
  descendantFolderIds,
} from "./legacy";
export type PlanAction = "today" | "next" | "review-tomorrow";
export function planNode(
  tasks: StudyTask[],
  nodeId: string,
  action: PlanAction,
  id: string,
  stamp: string,
): StudyTask[] {
  const tomorrow = new Date(stamp);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const study = action !== "review-tomorrow",
    date =
      action === "today"
        ? localDateKey(new Date(stamp))
        : action === "review-tomorrow"
          ? localDateKey(tomorrow)
          : "";
  const existing = tasks.find(
    (t) =>
      t.nodeId === nodeId &&
      t.status === "pending" &&
      (t.reason === "estudio") === study,
  );
  const patch = {
    plannedFor: date,
    planBucket: action === "next" ? ("next" as const) : ("today" as const),
    reason: study ? "estudio" : existing?.reason || "afianzar",
  };
  return existing
    ? tasks.map((t) => (t.id === existing.id ? { ...t, ...patch } : t))
    : [
        ...tasks,
        {
          id,
          nodeId,
          ...patch,
          note: "",
          status: "pending",
          createdAt: stamp,
          completedAt: null,
          assessment: null,
          completionNote: "",
          queueOrder: Math.max(-1, ...tasks.map((t) => t.queueOrder)) + 1,
        },
      ];
}
export function dueStudyTasks(tasks: StudyTask[], today = localDateKey()) {
  return tasks
    .filter(
      (t) =>
        t.status === "pending" &&
        t.planBucket !== "next" &&
        !!t.plannedFor &&
        t.plannedFor <= today,
    )
    .sort(
      (a, b) =>
        a.queueOrder - b.queueOrder ||
        a.plannedFor.localeCompare(b.plannedFor) ||
        a.createdAt.localeCompare(b.createdAt),
    );
}
export function cardsForStudyNode(
  nodes: StudyNode[],
  folders: Folder[],
  cards: Card[],
  id: string,
) {
  const nodesIn = studyDescendantIds(nodes, id),
    folderIds = new Set<string>(),
    cardIds = new Set<string>();
  nodes
    .filter((n) => nodesIn.has(n.id))
    .forEach((n) => {
      if (n.sourceFolderId)
        descendantFolderIds(folders, n.sourceFolderId).forEach((f) =>
          folderIds.add(f),
        );
      n.sourceCardIds?.forEach((c) => cardIds.add(c));
    });
  return cards.filter((c) => folderIds.has(c.folderId) || cardIds.has(c.id));
}
