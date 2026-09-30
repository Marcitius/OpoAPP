import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  emptyAccount,
  emptyState,
  operation,
  rowKey,
  type Row,
} from "../lib/data/models";
import {
  applyLocal,
  differences,
  mergeRemote,
  project,
} from "../lib/data/projection";
import { readAccount, transact } from "../lib/data/local";
import { mergeImport } from "../lib/sync/engine";
import { parseLegacy, validateState } from "../lib/data/legacy";
function fixture() {
  const s = emptyState();
  s.studyNodes = [
    { id: "root", name: "Tema", parentId: null, createdAt: "2026-09-30" },
    {
      id: "article",
      name: "Artículo X",
      parentId: "root",
      createdAt: "2026-09-30",
    },
  ];
  s.studyTasks = [
    {
      id: "task",
      nodeId: "article",
      status: "pending",
      plannedFor: "2026-09-30",
      note: "Nota",
      reason: "",
      createdAt: "2026-09-30",
      completedAt: null,
      assessment: null,
      completionNote: "",
      queueOrder: 0,
    },
  ];
  return s;
}
test("Offline actions and outbox survive reload, isolated by account", async () => {
  const source = fixture();
  await transact("A", (a) =>
    applyLocal(a, differences(emptyState(), source, a)),
  );
  assert.equal((await readAccount("A")).queue.length, 3);
  assert.equal(project((await readAccount("A")).rows).studyNodes.length, 2);
  assert.equal((await readAccount("B")).queue.length, 0);
});
test("Concurrent IDB transactions append operations without overwriting another tab", async () => {
  await Promise.all([
    transact("tabs", (a) =>
      applyLocal(a, [operation("settings", "one", { value: 1 })]),
    ),
    transact("tabs", (a) =>
      applyLocal(a, [operation("settings", "two", { value: 2 })]),
    ),
  ]);
  assert.equal((await readAccount("tabs")).queue.length, 2);
});
test("Completion snapshots retain two offline reviews and result comments", () => {
  const account = emptyAccount(),
    before = fixture();
  applyLocal(account, differences(emptyState(), before, account));
  const after = structuredClone(before);
  after.studyTasks[0] = {
    ...after.studyTasks[0],
    status: "done",
    assessment: "bien",
    completedAt: "2026-09-30T08:00:00Z",
  };
  applyLocal(account, differences(before, after, account));
  // A very fast comment can arrive before the UI received the IDB publication.
  const comment = structuredClone(after);
  comment.studyTasks[0].completionNote = "Literalidad";
  applyLocal(account, differences(after, comment, account));
  assert.equal(
    project(account.rows).studyTasks[0].completionNote,
    "Literalidad",
  );
  const second = structuredClone(before);
  second.studyTasks[0] = {
    ...second.studyTasks[0],
    status: "done",
    assessment: "mal",
    completedAt: "2026-09-30T08:01:00Z",
  };
  applyLocal(account, differences(before, second, account));
  const projected = project(account.rows);
  assert.equal(projected.studyTasks.length, 2);
  assert.deepEqual(projected.studyTasks.map((t) => t.assessment).sort(), [
    "bien",
    "mal",
  ]);
  const unchanged = differences(projected, structuredClone(projected), account);
  assert.equal(unchanged.length, 0);
});
test("Pull merges remote fields and retains unacknowledged local patches", () => {
  const account = emptyAccount();
  applyLocal(account, [
    operation("studyNodes", "x", { name: "Local", parentId: null }),
  ]);
  mergeRemote(
    account,
    [
      {
        kind: "studyNodes",
        id: "x",
        data: { name: "Remote", parentId: "parent" },
        revision: 5,
        deleted: false,
      },
    ],
    5,
  );
  assert.equal(account.rows["studyNodes:x"].data.name, "Local");
  assert.equal(account.rows["studyNodes:x"].data.parentId, null);
  assert.equal(account.cursor, 5);
});
test("JSON import retains hierarchy, settings, history and does not revert completed reviews", () => {
  const original = fixture();
  original.studyTasks[0] = {
    ...original.studyTasks[0],
    status: "done",
    assessment: "regular",
    completedAt: "2026-09-30",
    completionNote: "Mi nota",
  };
  const imported = parseLegacy({ format: "OpoGC-export", state: original })!;
  validateState(imported);
  assert.equal(imported.studyNodes[1].parentId, "root");
  assert.equal(imported.studyTasks[0].completionNote, "Mi nota");
  assert.equal(mergeImport(imported, fixture()).studyTasks[0].status, "done");
});
test("Study-only export recreates supplied history and rejects cycles", () => {
  const imported = parseLegacy({
    arbol: [{ id: "x", name: "Tema", children: [] }],
    elementos: [
      {
        id: "x",
        historial: [
          {
            fecha: "2026-09-30",
            resultado: "bien",
            comentario_resultado: "Nota",
          },
        ],
        pendientes: [],
      },
    ],
  })!;
  assert.equal(imported.studyTasks[0].completionNote, "Nota");
  validateState(imported);
  const bad = fixture();
  bad.studyNodes[0].parentId = "article";
  assert.throws(() => validateState(bad), /ciclo/);
});

test("A portable backup with normalized history creates task parents on a new account", () => {
  const a = emptyAccount(),
    before = fixture();
  applyLocal(a, differences(emptyState(), before, a));
  const done = structuredClone(before);
  done.studyTasks[0] = {
    ...done.studyTasks[0],
    status: "done",
    assessment: "bien",
    completedAt: "2026-09-30T12:00:00Z",
  };
  applyLocal(a, differences(before, done, a));
  const backup = project(a.rows),
    fresh = emptyAccount();
  const ops = differences(emptyState(), backup, fresh);
  assert.ok(ops.some((op) => op.kind === "studyTasks" && op.id === "task"));
  applyLocal(fresh, ops);
  assert.equal(project(fresh.rows).studyTasks.length, 1);
});

test("Sync requests bind a token to its account and refuse another account session", async () => {
  const { SyncEngine } = await import("../lib/sync/engine");
  let requested = false,
    header = "";
  let current = "B";
  const client = {
    auth: {
      getSession: async () => ({
        data: {
          session: { user: { id: current }, access_token: "token-" + current },
        },
      }),
    },
    rpc: () => {
      requested = true;
      return {
        setHeader: (name: string, value: string) => {
          header = value;
          return Promise.resolve({ data: [], error: null });
        },
      };
    },
  };
  const engine = new SyncEngine("A", client as any);
  await assert.rejects(
    () => (engine as any).rpc("apply_operations", {}),
    /cuenta/,
  );
  assert.equal(requested, false);
  current = "A";
  await (engine as any).rpc("pull_changes", {});
  assert.equal(header, "Bearer token-A");
});

test("An offline tree projection stays traversable during a concurrent conflicting move", () => {
  const a = emptyAccount();
  applyLocal(a, [
    operation("studyNodes", "one", { name: "One", parentId: "two" }),
    operation("studyNodes", "two", { name: "Two", parentId: "one" }),
  ]);
  const tree = project(a.rows).studyNodes;
  assert.ok(tree.some((n) => n.parentId === null));
  assert.equal(tree.length, 2);
});
