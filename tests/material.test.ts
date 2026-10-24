import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { emptyState } from "../lib/data/models";
import {
  project,
  flatten,
  mergeRemote,
  applyLocal,
  differences,
} from "../lib/data/projection";
import { readAccount, transact } from "../lib/data/local";
import { mergeImport } from "../lib/sync/engine";
import type { AppState } from "../lib/study/legacy";
import {
  createMaterial,
  materialNodes,
  materialHtml,
  nodeKey,
  contentKey,
  saveMaterial,
  moveMaterial,
  reorderMaterial,
  deleteMaterial,
  copyLibraryStructure,
} from "../lib/material/model";
import {
  markdownToMaterial,
  sanitizeMaterial,
  clipboardMaterial,
} from "../lib/material/format";
const stamp = "2026-10-24T10:00:00Z";
const initial = () => emptyState() as AppState;
test("Markdown converts headings, emphasis, nested lists, tables, quotes, rule and Unicode without visible syntax", () => {
  const html = markdownToMaterial(
    "# Ley\n\n## Apartado\n\n**Negrita** y *cursiva*, ~~tachado~~.\n\n- Uno\n  - Hijo\n- Dos\n\n> Cita\n\n---\n\n| Órgano | Función |\n| --- | --- |\n| A | B |",
  );
  for (const tag of [
    "h1",
    "h2",
    "strong",
    "em",
    "del",
    "ul",
    "li",
    "blockquote",
    "hr",
    "table",
    "th",
    "td",
  ])
    assert.match(html, new RegExp("<" + tag + "[ >]"));
  assert.ok(!html.includes("**"));
  assert.match(html, /Órgano/);
});
test("Alphabetic and escaped ChatGPT lists become editable lists while literal footnote asterisks remain", () => {
  const html = markdownToMaterial(
    "a) Primera opción.\n\nb) Segunda opción.\n\nc) Tercera opción.\n\n\\- Otra lista\n\\- Segundo punto\n\nNota (\\*).",
  );
  assert.match(html, /<ol type="a" start="1">/);
  assert.equal((html.match(/<li>/g) || []).length, 5);
  assert.match(html, /Nota \(\*\)/);
  assert.ok(!html.includes("\\-"));
});
test("Rich clipboard preserves actual styles, merged cells and semantic formatting; plain clipboard uses Markdown", () => {
  const rich =
    '<h4>Título</h4><p><span style="font-size: 24px; color: red; font-family: Georgia">Texto</span></p><table><tr><td colspan="2">Dato</td></tr></table>';
  const html = clipboardMaterial(rich, "Texto");
  assert.match(html, /font-size: 24px/);
  assert.match(html, /colspan="2"/);
  assert.match(html, /<h4>/);
  assert.match(
    clipboardMaterial("", "# Título\n\n**Clave**"),
    /<strong>Clave<\/strong>/,
  );
});
test("Imported HTML removes executable content, remote media and layout injection", () => {
  const html = sanitizeMaterial(
    '<script>alert(1)</script><img src="https://tracker.invalid"><iframe src="https://x.invalid"></iframe><p onclick="x()" style="color: red; position:fixed; background-color: url(javascript:x)">Seguro <a href="javascript:x">enlace</a></p>',
  );
  assert.ok(!/script|onclick|position:|url\(|<img|<iframe/i.test(html));
  assert.match(html, /color: red/);
  assert.match(html, /Seguro/);
});
test("Material hierarchy is separate; moving parents carries descendants, reorder and delete preserve study/cards", () => {
  let s = initial();
  const untouched = structuredClone(s);
  s = createMaterial(s, "a", "Ley", null, stamp);
  s = createMaterial(s, "b", "Interesados", "a", stamp);
  s = createMaterial(s, "c", "Representación", "b", stamp);
  s = createMaterial(s, "d", "Otro", null, stamp);
  s = saveMaterial(s, "c", "<p>Contenido</p>", "", stamp);
  s = moveMaterial(s, ["b"], "d", stamp);
  assert.equal(
    materialNodes(s.settings).find((n) => n.id === "c")!.parentId,
    "b",
  );
  assert.equal(materialHtml(s.settings, "c"), "<p>Contenido</p>");
  assert.throws(() => moveMaterial(s, ["d"], "c", stamp), /fuera|misma/);
  s = reorderMaterial(s, "d", -1, stamp);
  assert.ok(
    materialNodes(s.settings).find((n) => n.id === "d")!.sortOrder <
      materialNodes(s.settings).find((n) => n.id === "a")!.sortOrder,
  );
  s = deleteMaterial(s, "d", stamp);
  assert.deepEqual(
    materialNodes(s.settings).map((n) => n.id),
    ["a"],
  );
  for (const key of [
    "cards",
    "folders",
    "reviews",
    "studyTasks",
    "studyNodes",
  ] as const)
    assert.deepEqual(s[key], untouched[key]);
});
test("Copying Library folders is idempotent and independent of future folder moves, IDs or card scheduling", () => {
  let s = initial();
  s.folders = [
    {
      id: "f",
      name: "Tema",
      parentId: null,
      color: "#285943",
      createdAt: stamp,
    },
    {
      id: "g",
      name: "Subtema",
      parentId: "f",
      color: "#285943",
      createdAt: stamp,
    },
  ];
  const old = structuredClone(s);
  s = copyLibraryStructure(s, ["f"], null, stamp);
  const first = materialNodes(s.settings);
  s = copyLibraryStructure(s, ["f"], null, stamp);
  assert.deepEqual(materialNodes(s.settings), first);
  assert.equal(first.length, 2);
  assert.ok(first.every((n) => !["f", "g"].includes(n.id)));
  assert.equal(first[1].parentId, first[0].id);
  assert.deepEqual(s.folders, old.folders);
  assert.deepEqual(s.cards, old.cards);
});
test("Content CAS rejects stale edits and renamed/moved nodes keep their document identity", () => {
  let s = createMaterial(initial(), "a", "Tema", null, stamp);
  s = saveMaterial(s, "a", "<p>Primera</p>", "", stamp);
  assert.throws(
    () => saveMaterial(s, "a", "Otra versión", "", stamp),
    /material-conflict/,
  );
  s.settings[nodeKey("a")] = {
    ...s.settings[nodeKey("a")],
    name: "Renombrado",
  };
  assert.equal(materialHtml(s.settings, "a"), "<p>Primera</p>");
  s = deleteMaterial(s, "a", stamp);
  assert.throws(
    () => saveMaterial(s, "a", "Texto", "<p>Primera</p>", stamp),
    /eliminado/,
  );
});
test("Materials survive real offline IndexedDB, reopening, remote projection and backup merge with account isolation", async () => {
  let s = createMaterial(initial(), "law", "Ley 39", null, stamp);
  s = saveMaterial(
    s,
    "law",
    "<h1>Texto</h1><table><tr><td>Dato</td></tr></table>",
    "",
    stamp,
  );
  await transact("material-owner", (a) =>
    applyLocal(a, differences(initial(), s, a)),
  );
  const local = await readAccount("material-owner");
  assert.ok(local.queue.length >= 2);
  const reopened = project(local.rows) as AppState;
  assert.equal(
    materialHtml(reopened.settings, "law"),
    materialHtml(s.settings, "law"),
  );
  const remote = await readAccount("material-device");
  mergeRemote(
    remote,
    Object.values(flatten(reopened)).map((r) => ({
      ...r,
      revision: 1,
      deleted: false,
    })),
    1,
  );
  assert.deepEqual(
    materialNodes((project(remote.rows) as AppState).settings),
    materialNodes(s.settings),
  );
  const merged = mergeImport(
    initial(),
    JSON.parse(JSON.stringify(reopened)),
  ) as AppState;
  assert.equal(
    materialHtml(merged.settings, "law"),
    materialHtml(s.settings, "law"),
  );
  assert.equal(
    (await readAccount("material-other-user")).rows[
      "settings:" + contentKey("law")
    ],
    undefined,
  );
});
test("Conflicting offline moves still produce a traversable material tree without changing stored records", () => {
  let s = createMaterial(initial(), "a", "A", null, stamp);
  s = createMaterial(s, "b", "B", "a", stamp);
  s.settings[nodeKey("a")].parentId = "b";
  const nodes = materialNodes(s.settings);
  assert.ok(nodes.some((n) => n.parentId === null));
  assert.equal(s.settings[nodeKey("a")].parentId, "b");
});
test("Library structure copy preserves reordered siblings", () => {
  let s = initial();
  s.folders = [
    {
      id: "first",
      name: "Primero",
      parentId: null,
      color: "#285943",
      createdAt: stamp,
      sortOrder: 1,
    },
    {
      id: "second",
      name: "Segundo",
      parentId: null,
      color: "#285943",
      createdAt: stamp,
      sortOrder: 0,
    },
  ];
  s = copyLibraryStructure(s, [], null, stamp);
  const nodes = materialNodes(s.settings).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  assert.deepEqual(
    nodes.map((n) => n.name),
    ["Segundo", "Primero"],
  );
});
