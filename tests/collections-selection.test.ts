import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  assignCollection,
  reviewCollections,
  inCollection,
  saveCollection,
  cardsInCollection,
  membershipKey,
} from "../lib/review/collections";
import {
  moveLibrarySelection,
  moveBranches,
  selectionRoots,
  scopedCards,
  scopedProgress,
  searchText,
} from "../lib/study/selection";
import { emptyState, emptyAccount, operation } from "../lib/data/models";
import {
  differences,
  applyLocal,
  project,
  mergeRemote,
  flatten,
} from "../lib/data/projection";
import { transact, readAccount } from "../lib/data/local";
import { mergeImport } from "../lib/sync/engine";
import type { AppState } from "../lib/study/legacy";
const stamp = "2026-10-14T18:00:00Z";
function fixture(): AppState {
  const s = emptyState();
  s.folders = [
    {
      id: "ce",
      name: "Constitución",
      parentId: null,
      createdAt: stamp,
      color: "#285943",
    },
    {
      id: "one",
      name: "Título I",
      parentId: "ce",
      createdAt: stamp,
      color: "#285943",
    },
    {
      id: "chapter",
      name: "Capítulo II",
      parentId: "one",
      createdAt: stamp,
      color: "#285943",
    },
    {
      id: "dp",
      name: "Defensor",
      parentId: null,
      createdAt: stamp,
      color: "#285943",
    },
  ];
  s.cards = [
    {
      id: "c27",
      folderId: "chapter",
      front: "Artículo 27",
      back: "Educación",
      dueAt: "2026-10-20",
      fsrsStability: 20,
      reviewCount: 8,
    },
    {
      id: "c53",
      folderId: "one",
      front: "Artículo 53",
      back: "Garantías",
      dueAt: "2026-10-22",
      fsrsStability: 30,
      reviewCount: 12,
    },
    {
      id: "other",
      folderId: "dp",
      front: "Adjuntos",
      back: "",
      dueAt: "2026-10-25",
      reviewCount: 2,
    },
  ];
  s.reviews = [
    {
      id: "r1",
      cardId: "c27",
      rating: "hard",
      correct: true,
      reviewedAt: stamp,
    },
  ];
  s.studyNodes = [
    {
      id: "root",
      name: "CE",
      parentId: null,
      createdAt: stamp,
      sourceFolderId: "ce",
    },
    {
      id: "child",
      name: "Título I",
      parentId: "root",
      createdAt: stamp,
      sourceFolderId: "one",
    },
    {
      id: "article",
      name: "Artículo 27",
      parentId: "child",
      createdAt: stamp,
      sourceCardIds: ["c27"],
    },
  ];
  s.studyTasks = [
    {
      id: "task",
      nodeId: "article",
      note: "Mi nota",
      status: "pending",
      plannedFor: "2026-10-15",
    },
  ];
  return s as AppState;
}
test("Guardar antes de responder no modifica ratings ni memoria", () => {
  const s = fixture(),
    r = assignCollection(s, "regular", ["c27"], true);
  assert.equal(r.cards, s.cards);
  assert.equal(r.reviews, s.reviews);
  assert.equal(r.studyTasks, s.studyTasks);
  assert.ok(inCollection(r.settings, "regular", "c27"));
  assert.equal(s.settings[membershipKey("regular", "c27")], undefined);
});
test("Responder bien y mover conserva la colección; retirada explícita", () => {
  let s = assignCollection(fixture(), "regular", ["c27"], true);
  s = {
    ...s,
    cards: s.cards.map((c) =>
      c.id === "c27" ? { ...c, dueAt: "2026-11-14" } : c,
    ),
  };
  s = moveLibrarySelection(s, ["one"], ["c27"], "dp", "unused", stamp);
  assert.equal(cardsInCollection(s, "regular")[0].dueAt, "2026-11-14");
  assert.equal(s.cards[0].folderId, "chapter");
  assert.equal(
    cardsInCollection(assignCollection(s, "regular", ["c27"], false), "regular")
      .length,
    0,
  );
});
test("Varias colecciones, renombrado y borrado persistente sin seeds", () => {
  let s = saveCollection(fixture(), { id: "custom", name: "Plazos" });
  s = assignCollection(s, "custom", ["c27"], true);
  s = assignCollection(s, "regular", ["c27"], true);
  s = saveCollection(s, { id: "regular", name: "Afianzar" });
  assert.equal(
    reviewCollections(s.settings).find((c) => c.id === "regular")?.name,
    "Afianzar",
  );
  s = saveCollection(s, { id: "mal", name: "Mal", deleted: true });
  assert.ok(
    !reviewCollections(JSON.parse(JSON.stringify(s.settings))).some(
      (c) => c.id === "mal",
    ),
  );
  assert.equal(cardsInCollection(s, "custom").length, 1);
});
test("Filtros por rama incluyen descendientes y búsqueda sin tildes", () => {
  const s = fixture();
  assert.deepEqual(
    scopedCards(s, ["one"], []).map((c) => c.id),
    ["c27", "c53"],
  );
  assert.equal(scopedCards(s, ["ce", "dp"], []).length, 3);
  assert.deepEqual(
    scopedCards(s, [], ["article"]).map((c) => c.id),
    ["c27"],
  );
  assert.equal(searchText("Constitución"), searchText("constitucion"));
});
test("Padre e hijo seleccionados se mueven una vez y conservan relaciones", () => {
  const s = fixture(),
    r = moveLibrarySelection(
      s,
      ["one", "chapter"],
      ["c27", "other"],
      "dp",
      "unused",
      stamp,
    );
  assert.deepEqual(selectionRoots(s.folders, ["one", "chapter"]), ["one"]);
  assert.equal(r.folders.find((f) => f.id === "one")?.parentId, "dp");
  assert.equal(r.folders.find((f) => f.id === "chapter")?.parentId, "one");
  assert.equal(r.cards[0].folderId, "chapter");
  assert.equal(r.reviews, s.reviews);
  assert.equal(r.studyTasks, s.studyTasks);
  assert.deepEqual(
    r.cards.map((c) => c.id),
    s.cards.map((c) => c.id),
  );
});
test("Ciclos y destinos inexistentes rechazan todo el lote", () => {
  const s = fixture(),
    before = JSON.stringify(s);
  assert.throws(() =>
    moveLibrarySelection(
      s,
      ["one", "dp"],
      ["other"],
      "chapter",
      "unused",
      stamp,
    ),
  );
  assert.equal(JSON.stringify(s), before);
  assert.throws(() => moveBranches(s.studyNodes, ["child"], "missing"));
});
test("Mover ramas del temario a raíz conserva vínculos y planificación", () => {
  const s = fixture(),
    r = moveBranches(s.studyNodes, ["child", "article"], null);
  assert.equal(r.find((n) => n.id === "child")?.parentId, null);
  assert.equal(r.find((n) => n.id === "article")?.parentId, "child");
  assert.deepEqual(r.find((n) => n.id === "article")?.sourceCardIds, ["c27"]);
  assert.equal(s.studyTasks[0].nodeId, "article");
});
test("Tarjetas a raíz crean una carpeta válida reutilizable", () => {
  const s = fixture(),
    r = moveLibrarySelection(s, [], ["c27"], null, "unfiled", stamp),
    r2 = moveLibrarySelection(r, [], ["c53"], null, "unused", stamp);
  assert.equal(r.cards[0].folderId, "unfiled");
  assert.ok(r.folders.some((f) => f.id === "unfiled" && f.isUnfiled));
  assert.equal(r2.folders.length, r.folders.length);
  assert.equal(r2.cards[1].folderId, "unfiled");
});
test("Colecciones y movimientos sobreviven a recarga offline en IndexedDB", async () => {
  const user = "v13-offline";
  await transact(user, (a) =>
    applyLocal(
      a,
      Object.values(flatten(fixture())).map((r) =>
        operation(r.kind, r.id, r.data),
      ),
    ),
  );
  await transact(user, (a) => {
    const before = project(a.rows) as AppState;
    const after = moveLibrarySelection(
      assignCollection(before, "regular", ["c27"], true),
      ["one"],
      ["other"],
      "ce",
      "unused",
      stamp,
    );
    applyLocal(a, differences(before, after, a));
  });
  const a = await readAccount(user),
    s = project(a.rows) as AppState;
  assert.ok(inCollection(s.settings, "regular", "c27"));
  assert.equal(s.cards.find((c) => c.id === "other")?.folderId, "ce");
  assert.ok(a.queue.length > 0);
  const last = a.queue.filter(
    (o) => o.patch.value === true || o.patch.folderId === "ce",
  );
  assert.equal(new Set(last.map((o) => o.txn_id)).size, 1);
});
test("Asignaciones independientes de dispositivos, aislamiento y backup/import", () => {
  const s = fixture(),
    a = emptyAccount(),
    b = emptyAccount();
  applyLocal(
    a,
    Object.values(flatten(s)).map((r) => operation(r.kind, r.id, r.data)),
  );
  a.queue = [];
  applyLocal(
    a,
    differences(s, assignCollection(s, "regular", ["c27"], true), a),
  );
  const remote = differences(
    s,
    assignCollection(s, "regular", ["c53"], true),
    b,
  ).map((o) => ({
    kind: o.kind,
    id: o.id,
    data: { ...o.patch, id: o.id },
    revision: 1,
    deleted: false,
  }));
  mergeRemote(a, remote, 1);
  const merged = project(a.rows) as AppState;
  assert.equal(cardsInCollection(merged, "regular").length, 2);
  assert.equal(
    cardsInCollection(project(b.rows) as AppState, "regular").length,
    0,
  );
  assert.equal(
    cardsInCollection(
      mergeImport(emptyState(), JSON.parse(JSON.stringify(merged))) as AppState,
      "regular",
    ).length,
    2,
  );
});
test("Progreso respeta contenido y apartados vinculados del ámbito", () => {
  const s = fixture(),
    r = scopedProgress(s, ["dp"], []);
  assert.deepEqual(
    r.cards.map((c) => c.id),
    ["other"],
  );
  assert.equal(r.reviews.length, 0);
  assert.equal(r.studyTasks.length, 0);
  assert.equal(r.studyNodes.length, 0);
  const n = scopedProgress(s, [], ["article"]);
  assert.deepEqual(
    n.cards.map((c) => c.id),
    ["c27"],
  );
  assert.equal(n.reviews.length, 1);
  assert.equal(n.studyTasks[0].id, "task");
});
