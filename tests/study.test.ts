import { test } from "node:test";
import assert from "node:assert/strict";
import {
  moveBranch,
  moveOut,
  orderedChildren,
  reorderItems,
} from "../lib/study/hierarchy";
import {
  planNode,
  dueStudyTasks,
  cardsForStudyNode,
} from "../lib/study/planning";
import {
  libraryDraft,
  materializeLibraryDraft,
  moveDraft,
} from "../lib/study/libraryBridge";
import type { StudyNode, Folder, Card } from "../lib/study/legacy";
const stamp = "2026-10-02T08:00:00Z";
const nodes: StudyNode[] = [
  { id: "root", parentId: null, name: "Tema", createdAt: stamp },
  { id: "a", parentId: "root", name: "Capítulo", createdAt: stamp },
  { id: "child", parentId: "a", name: "Artículo", createdAt: stamp },
  { id: "b", parentId: "root", name: "Otro", createdAt: stamp },
];
test("Universal reorder ranks siblings without changing IDs or branch contents", () => {
  const r = reorderItems(nodes, "b", -1);
  assert.deepEqual(
    orderedChildren(r, "root").map((n) => n.id),
    ["b", "a"],
  );
  assert.equal(r.find((n) => n.id === "child")?.parentId, "a");
  assert.deepEqual(
    new Set(r.map((n) => n.id)),
    new Set(nodes.map((n) => n.id)),
  );
});
test("A parent move carries its entire branch, can move out, and rejects descendant cycles", () => {
  const r = moveBranch(nodes, "a", "b");
  assert.equal(r.find((n) => n.id === "child")?.parentId, "a");
  assert.equal(r.find((n) => n.id === "a")?.parentId, "b");
  assert.equal(moveOut(r, "a").find((n) => n.id === "a")?.parentId, "root");
  assert.throws(() => moveBranch(nodes, "root", "child"));
  assert.throws(() => moveBranch(nodes, "a", "missing"));
});
test("Cards reorder independently inside their existing folders", () => {
  const c = [
      { id: "x", folderId: "deck", front: "a" },
      { id: "y", folderId: "deck", front: "b" },
      { id: "z", folderId: "other", front: "c" },
    ],
    r = reorderItems(c, "y", -1, "folderId");
  assert.deepEqual(
    orderedChildren(r, "deck", "folderId").map((n) => n.id),
    ["y", "x"],
  );
  assert.equal(r[2], c[2]);
});
test("Quick plans are idempotent, undated next is not due, tomorrow uses the supplied clock", () => {
  let tasks = planNode([], "a", "next", "plan", stamp);
  assert.equal(tasks[0].plannedFor, "");
  assert.equal(dueStudyTasks(tasks, "2026-10-02").length, 0);
  tasks = planNode(tasks, "a", "today", "ignored", stamp);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, "plan");
  assert.equal(dueStudyTasks(tasks, "2026-10-02").length, 1);
  tasks = planNode(tasks, "a", "review-tomorrow", "review", stamp);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[1].plannedFor, "2026-10-03");
});
const folders: Folder[] = [
  {
    id: "folder",
    name: "Biblioteca",
    parentId: null,
    color: "#285943",
    createdAt: stamp,
  },
  {
    id: "sub",
    name: "Capítulo",
    parentId: "folder",
    color: "#285943",
    createdAt: stamp,
  },
];
const cards = [
  { id: "card1", folderId: "sub", front: "Artículo 53 · Garantías" },
  { id: "card2", folderId: "sub", front: "Artículo 53 · Otra pregunta" },
  { id: "card3", folderId: "sub", front: "Artículo 164 · Sentencias" },
] as Card[];
function ids() {
  let i = 0;
  return () => "new-" + ++i;
}
test("Library preview groups article cards, supports names and reparenting, and never copies a card", () => {
  let draft = libraryDraft(folders, cards);
  assert.equal(draft.length, 4);
  const article = draft.find((n) => n.name === "Artículo 53")!;
  assert.deepEqual(article.sourceCardIds, ["card1", "card2"]);
  draft = moveDraft(draft, article.id, null).map((n) =>
    n.id === article.id ? { ...n, name: "Garantías" } : n,
  );
  const result = materializeLibraryDraft(nodes, draft, "root", ids(), stamp);
  assert.equal(result.created, 4);
  const imported = result.nodes.find((n) => n.name === "Garantías")!;
  assert.equal(imported.parentId, "root");
  assert.deepEqual(
    cardsForStudyNode(result.nodes, folders, cards, imported.id).map(
      (c) => c.id,
    ),
    ["card1", "card2"],
  );
  assert.equal(cards.length, 3);
});
test("Reimport preserves node identity, createdAt and unrelated legacy data; excluded ancestors are promoted", () => {
  const draft = libraryDraft(folders, cards),
    first = materializeLibraryDraft(nodes, draft, null, ids(), stamp),
    second = materializeLibraryDraft(
      first.nodes,
      draft,
      null,
      ids(),
      "2026-10-03",
    );
  assert.equal(second.created, 0);
  assert.equal(second.updated, 4);
  assert.deepEqual(
    second.nodes.map((n) => n.id),
    first.nodes.map((n) => n.id),
  );
  assert.equal(second.nodes.find((n) => n.id === "child")?.name, "Artículo");
  const filtered = draft.map((n) => ({
      ...n,
      selected: n.name === "Artículo 53",
    })),
    only = materializeLibraryDraft(nodes, filtered, "a", ids(), stamp);
  assert.equal(only.created, 1);
  assert.equal(only.nodes.at(-1)?.parentId, "a");
  assert.equal(only.nodes.at(-1)?.createdAt, stamp);
});
test("Import rejects cycles and invalid targets before touching existing structures", () => {
  const draft = libraryDraft(folders, cards);
  assert.throws(() => moveDraft(draft, draft[0].id, draft[1].id));
  assert.throws(() =>
    materializeLibraryDraft(nodes, draft, "missing", ids(), stamp),
  );
  assert.throws(() =>
    materializeLibraryDraft(
      nodes,
      draft.map((n) => ({ ...n, name: "" })),
      null,
      ids(),
      stamp,
    ),
  );
  assert.equal(nodes.length, 4);
});
