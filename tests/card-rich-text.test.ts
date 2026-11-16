import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { sanitizeRichHtml, plainRichText } from "../app/RichTextEditor";
import { clipboardMaterial, markdownToMaterial } from "../lib/material/format";
import { emptyState } from "../lib/data/models";
import { readAccount, transact } from "../lib/data/local";
import {
  differences,
  applyLocal,
  project,
  flatten,
  mergeRemote,
} from "../lib/data/projection";
import { mergeCardContent } from "../lib/review/sessionActions";
import { mergeImport } from "../lib/sync/engine";
import type { AppState, Card } from "../lib/study/legacy";

const rich =
  '<h4>Condiciones</h4><p style="text-align: center; line-height: 1.5; margin-left: 24px" data-indent="1"><strong>Voz</strong>, <em>voto</em>, <u>excepción</u> y <s>error</s>.</p><p><span style="font-family: Georgia; font-size: 24px; color: #285943">Texto</span> <mark data-color="#fff19b" style="background-color: #fff19b">clave</mark> H<sub>2</sub>O x<sup>2</sup></p><ol type="a" start="3"><li><p>Primero</p><ul><li><p>Detalle</p></li></ul></li><li><p>Segundo</p></li></ol><table><tbody><tr><th colspan="2"><p>Órgano</p></th></tr><tr><td rowspan="2" colwidth="100"><p>Secretario</p></td><td><p>Redacta</p></td></tr><tr><td><p>Autoriza</p></td></tr></tbody></table><blockquote><p>Condición</p></blockquote><hr><pre><code>literal</code></pre>';
const stamp = "2026-11-16T12:00:00Z";
function card(id: string, type: Card["type"] = "basic"): Card {
  return {
    id,
    type,
    folderId: "folder",
    front: "Pregunta antigua",
    back: "Respuesta antigua",
    options: [],
    correctOption: 0,
    correctOptions: [],
    dueAt: stamp,
    createdAt: stamp,
    lastReviewedAt: stamp,
    intervalDays: 25,
    ease: 0,
    repetitions: 8,
    lapses: 2,
    streak: 3,
    reviewCount: 12,
    successCount: 10,
    attachment: null,
    fsrsStability: 32,
    fsrsDifficulty: 6,
    fsrsReps: 12,
    orthographyIsCorrect: null,
    orthographyCorrectForm: "",
    orthographyExplanation: "",
    orthographySource: "",
    orthographyStage: 1,
  };
}

test("Card HTML retains headings, inline styles, lists, indentation, tables and emphasis through repeated saves", () => {
  const html = sanitizeRichHtml(rich);
  for (const tag of [
    "h4",
    "strong",
    "em",
    "u",
    "s",
    "mark",
    "sub",
    "sup",
    "ol",
    "ul",
    "table",
    "th",
    "td",
    "blockquote",
    "hr",
    "pre",
    "code",
  ])
    assert.match(html, new RegExp("<" + tag + "[ >]"));
  for (const attr of [
    'type="a"',
    'start="3"',
    'colspan="2"',
    'rowspan="2"',
    'colwidth="100"',
    'data-indent="1"',
    "font-family: Georgia",
    "font-size: 24px",
    "line-height: 1.5",
  ])
    assert.ok(html.includes(attr), attr);
  assert.equal(sanitizeRichHtml(html), html);
});

test("Card rich paste removes executable content and layout injection without dropping legitimate text formatting", () => {
  const html = sanitizeRichHtml(
    clipboardMaterial(
      '<script>bad()</script><h5>Título</h5><p onclick="bad()" style="color: red; position: fixed; background-color: url(javascript:bad)"><b>Seguro</b> <a href="javascript:bad()">enlace</a></p><iframe src="https://unsafe.invalid"></iframe>',
      "Seguro",
    ),
  );
  assert.ok(!/script|onclick|position:|url\(|<iframe/i.test(html));
  assert.match(html, /<h5>Título/);
  assert.match(html, /color: red/);
  assert.match(html, /<b>Seguro/);
});

test("Formatted card fields keep image attachments separate and never embed remote or private Material images", () => {
  const html = sanitizeRichHtml(
    '<p>Antes</p><img src="https://unsafe.invalid/a.png"><img data-material-image="bb073725-ccfe-4085-81f0-a97218f7ec9c"><p>Después</p>',
  );
  assert.equal(html, "<p>Antes</p><p>Después</p>");
});

test("Small rich clipboard fragments keep underline, italic and links instead of falling back to plain text", () => {
  for (const [html, text] of [
    ["<u>Subrayado</u>", "Subrayado"],
    ["<i>Cursiva</i>", "Cursiva"],
    ['<a href="https://example.test">Referencia</a>', "Referencia"],
  ])
    assert.equal(clipboardMaterial(html, text), html);
});

test("Plain Markdown paste creates editable formatting rather than literal hashes or asterisks", () => {
  const html = sanitizeRichHtml(
    clipboardMaterial(
      "",
      "## Secretario\n\n**Redacta** y *autoriza* las actas.\n\n1. Voz\n2. Voto\n\n- Condición\n  - Miembro\n\n| Órgano | Función |\n| --- | --- |\n| Secretario | Actas |",
    ),
  );
  for (const tag of ["h2", "strong", "em", "ol", "ul", "table"])
    assert.match(html, new RegExp("<" + tag + "[ >]"));
  assert.ok(!html.includes("**") && !html.includes("## "));
});

test("Copied Unicode bullets and Markdown code-copy are interpreted as lists without replacing literal footnotes", () => {
  const text = "• Uno\n• Dos\n\nNota (\\*).";
  assert.equal((markdownToMaterial(text).match(/<li>/g) || []).length, 2);
  assert.match(
    clipboardMaterial("<pre>**Clave**</pre>", "**Clave**"),
    /<strong>Clave<\/strong>/,
  );
  assert.match(markdownToMaterial(text), /Nota \(\*\)/);
});

test("Plain text for search and written grading separates headings, paragraphs and table cells", () => {
  assert.equal(
    plainRichText(
      "<h4>Condición</h4><div>Voz</div><table><tr><td>A</td><td>B</td></tr></table><p>Fin &amp; &lt;literal&gt;</p>",
    ),
    "Condición\nVoz\nA B \nFin & <literal>",
  );
  assert.equal(plainRichText("contenido esencial"), "contenido esencial");
  assert.equal(
    sanitizeRichHtml("Respuesta antigua sin HTML"),
    "Respuesta antigua sin HTML",
  );
});

test("Formatting changes preserve card identity, attachment, grading options and the latest review state for every editable type", () => {
  for (const type of ["basic", "choice", "test", "written"] as const) {
    const old = card(type, type);
    old.options = ["A", "B", "C", "D"];
    old.attachment = {
      id: "asset",
      key: "owner/asset",
      name: "imagen.png",
      type: "image/png",
      size: 68,
      url: "supabase://owner/asset",
    };
    const latest = {
      ...old,
      reviewCount: 30,
      fsrsStability: 55,
      dueAt: "2027-04-01T12:00:00Z",
    };
    const next = mergeCardContent(latest, {
      ...old,
      front: sanitizeRichHtml("<h2>Pregunta</h2>"),
      back: sanitizeRichHtml(rich),
    });
    assert.deepEqual(
      { ...next, front: latest.front, back: latest.back },
      latest,
    );
  }
});

test("Rich card content survives offline IndexedDB, reopen, remote projection and backup import without rewriting history", async () => {
  const s = emptyState() as AppState;
  s.folders = [
    {
      id: "folder",
      name: "Tema",
      parentId: null,
      color: "#285943",
      createdAt: stamp,
    },
  ];
  s.cards = [
    {
      ...card("rich"),
      front: sanitizeRichHtml("<h2>Pregunta</h2>"),
      back: sanitizeRichHtml(rich),
    },
  ];
  s.reviews = [
    {
      id: "past",
      cardId: "rich",
      rating: "good",
      correct: true,
      reviewedAt: stamp,
    },
  ];
  await transact("rich-card-owner", (a) =>
    applyLocal(a, differences(emptyState(), s, a)),
  );
  const account = await readAccount("rich-card-owner");
  assert.ok(account.queue.length > 0);
  const reopened = project(account.rows) as AppState;
  assert.deepEqual(reopened.cards, s.cards);
  assert.deepEqual(reopened.reviews, s.reviews);
  const device = await readAccount("rich-card-device");
  mergeRemote(
    device,
    Object.values(flatten(reopened)).map((row) => ({
      ...row,
      revision: 1,
      deleted: false,
    })),
    1,
  );
  assert.deepEqual((project(device.rows) as AppState).cards, s.cards);
  const imported = mergeImport(
    emptyState(),
    JSON.parse(JSON.stringify(reopened)),
  ) as AppState;
  assert.deepEqual(imported.cards, s.cards);
  assert.deepEqual(imported.reviews, s.reviews);
  assert.equal(
    (await readAccount("rich-card-other-user")).rows["cards:rich"],
    undefined,
  );
});
