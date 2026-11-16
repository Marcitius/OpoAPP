import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { parseCardImport } from "../app/CardImportModal";
import { plainRichText } from "../app/RichTextEditor";
import {
  addTableColumn,
  addTableRow,
  cellAnswer,
  editTableCell,
  evaluableCells,
  exportStudyTable,
  markTableColumn,
  normalizeTableAnswer,
  parseStudyTable,
  pastedStudyTable,
  removeTableColumn,
  removeTableRow,
  tableHtml,
  tableKey,
  validateStudyTable,
  type StudyTable,
} from "../lib/tables/model";
import {
  anotherTableCombination,
  checkTable,
  createTableAttempt,
  evaluateTable,
  restoreTableAttempt,
  retryTable,
  tableScoreRating,
  type TableAttempt,
  type TableEvaluation,
} from "../lib/tables/learning";
import { prepareTableGrade } from "../lib/tables/grading";
import { tableTemplate } from "../lib/tables/json";
import {
  gradeIndex,
  scoreRating,
  scoreKind,
  validReviewScore,
  filterByGrade,
  defaultGradeFilter,
  orderByGrade,
} from "../lib/memory/grades";
import {
  answerSession,
  createCardSession,
  nextSessionCard,
  sessionSummary,
} from "../lib/memory/session";
import {
  cardSessionById,
  saveSessionPresentation,
  storeCardSession,
} from "../lib/memory/checkpoint";
import { readReviewDraft, writeReviewDraft } from "../lib/memory/draft";
import { emptyState, operation } from "../lib/data/models";
import {
  applyLocal,
  differences,
  flatten,
  mergeRemote,
  project,
} from "../lib/data/projection";
import { readAccount, transact } from "../lib/data/local";
import { mergeImport } from "../lib/sync/engine";
import { mergeCardContent } from "../lib/review/sessionActions";
import { dailyReport } from "../lib/reports/daily";
import type { AppState, Card, Review } from "../lib/study/legacy";
const stamp = "2026-11-16T12:00:00Z",
  now = Date.parse(stamp);
function table(count = 5): StudyTable {
  return validateStudyTable(
    parseStudyTable({
      columnas: ["Concepto", "Respuesta"],
      filas: Array.from({ length: count }, (_, i) => [
        `Concepto ${i + 1}`,
        { contenido: String(i + 1), evaluable: true },
      ]),
    }),
  );
}
function card(id = "table", definition = table()): Card {
  return {
    id,
    folderId: "folder",
    type: "table",
    table: definition,
    front: "<p>Completa la tabla</p>",
    back: tableHtml(definition),
    options: [],
    correctOption: 0,
    correctOptions: [],
    dueAt: stamp,
    createdAt: stamp,
    lastReviewedAt: null,
    intervalDays: 0,
    ease: 0,
    repetitions: 0,
    lapses: 0,
    streak: 0,
    reviewCount: 0,
    successCount: 0,
    attachment: null,
    fsrsStability: 0,
    fsrsDifficulty: 0,
    orthographyIsCorrect: null,
    orthographyCorrectForm: "",
    orthographyExplanation: "",
    orthographySource: "",
    orthographyStage: 1,
  };
}
function evaluated(
  definition: StudyTable,
  correct: number,
  percentage = definition.percentage,
) {
  let attempt = createTableAttempt(
    definition,
    "table",
    percentage,
    () => 0.314,
  );
  const cells = new Map(evaluableCells(definition).map((c) => [c.id, c]));
  attempt.answers = Object.fromEntries(
    attempt.hiddenIds.map((id, i) => [
      id,
      i < correct ? cellAnswer(cells.get(id)!) : "incorrecta",
    ]),
  );
  return checkTable(definition, attempt, stamp);
}
function review(
  score: number,
  sessionId: string,
  id = sessionId,
  evaluation?: TableEvaluation,
): Review {
  return {
    id,
    cardId: "table",
    rating: tableScoreRating(score),
    correct: score >= 5,
    score,
    cardSessionId: sessionId,
    scoreSource: "table-objective",
    reviewedAt: stamp,
    answerEvidence: { table: evaluation ?? evaluated(table(10), score).first! },
  };
}
function initial(): AppState {
  return {
    ...emptyState(),
    folders: [
      {
        id: "folder",
        name: "Mi tema",
        parentId: null,
        color: "#285943",
        createdAt: stamp,
      },
    ],
    cards: [card()],
  } as AppState;
}

test("Legacy JSON defaults to normal flashcard; brace markers never activate tables", () => {
  const result = parseCardImport({
    tarjetas: [{ pregunta: "Pregunta", respuesta: "{{18}}" }],
  });
  assert.equal(result[0].tipo, "flashcard");
  assert.equal(result[0].respuesta, "{{18}}");
  assert.equal(result[0].tabla, undefined);
});
test("New JSON type imports formatted cells, alternate answers, optional prompt and a deep route", () => {
  const [item] = parseCardImport({
    tarjetas: [
      {
        tipo: "tabla_muda",
        ruta: ["Tema", "Subtema", "Comité"],
        tabla: {
          columnas: ["Concepto", "Respuesta"],
          filas: [
            [
              "Mandato",
              {
                contenido: "**4 años**",
                evaluable: true,
                respuesta: "4 años",
                alternativas: ["4", "Cuatro años"],
              },
            ],
          ],
          porcentajeOculto: 50,
        },
      },
    ],
  });
  assert.equal(item.tipo, "tabla_muda");
  assert.deepEqual(item.ruta, ["Tema", "Subtema", "Comité"]);
  assert.equal(item.tema, "Tema");
  assert.match(item.pregunta, /Completa/);
  const cell = evaluableCells(item.tabla!)[0];
  assert.match(cell.html, /<strong>4 años/);
  assert.equal(cellAnswer(cell), "4 años");
  assert.deepEqual(cell.alternatives, ["4", "Cuatro años"]);
});
test("JSON table templates retain cell identities, rich content, configuration and folder path", () => {
  const before = initial();
  before.folders.push({
    id: "child",
    name: "Subtema",
    parentId: "folder",
    color: "#285943",
    createdAt: stamp,
  });
  const c = {
    ...before.cards[0],
    folderId: "child",
    front: "<h2>Enunciado <strong>importante</strong></h2>",
  };
  const template = tableTemplate(c, before.folders),
    [item] = parseCardImport(JSON.parse(JSON.stringify(template)));
  assert.deepEqual(item.tabla, c.table);
  assert.deepEqual(item.ruta, ["Mi tema", "Subtema"]);
  assert.match(item.pregunta, /<strong>importante/);
});
test("Table JSON validation rejects ragged grids, duplicate IDs, unsupported percentages and empty correct answers", () => {
  assert.throws(
    () => parseStudyTable({ columnas: ["A", "B"], filas: [["solo"]] }),
    /columnas/,
  );
  const dup = table();
  dup.rows[1].cells[1].id = dup.rows[0].cells[1].id;
  assert.throws(() => parseStudyTable(dup), /repetidos/);
  assert.throws(
    () =>
      parseStudyTable({
        columnas: ["A"],
        filas: [["x"]],
        porcentajeOculto: 30,
      }),
    /porcentaje/,
  );
  assert.throws(
    () =>
      validateStudyTable(
        parseStudyTable({
          columnas: ["A"],
          filas: [[{ contenido: "", evaluable: true }]],
        }),
      ),
    /respuesta correcta/,
  );
  assert.throws(
    () =>
      validateStudyTable(parseStudyTable({ columnas: ["A"], filas: [["x"]] })),
    /Marca/,
  );
});
test("Rich table cells are sanitized while headings, emphasis and lists remain; scripts and handlers cannot survive", () => {
  const t = parseStudyTable({
    columnas: ["Concepto", "Respuesta"],
    filas: [
      [
        "Dato",
        {
          html: '<script>bad()</script><p onclick="bad()"><strong>Correcto</strong></p><ul><li>Uno</li></ul><img src="x" onerror="bad()">',
          evaluable: true,
        },
      ],
    ],
  });
  const html = tableHtml(t);
  assert.ok(!/script|onclick|onerror|<img/.test(html));
  assert.match(html, /<strong>Correcto/);
  assert.match(html, /<ul>/);
  const answerOnly = validateStudyTable(
    parseStudyTable({
      columnas: ["Respuesta"],
      filas: [
        [{ html: "<p></p>", evaluable: true, respuesta: "4 años < 5 & 6" }],
      ],
    }),
  );
  assert.equal(
    plainRichText(tableHtml(answerOnly)).includes("4 años < 5 & 6"),
    true,
  );
  assert.match(tableHtml(answerOnly), /4 años &lt; 5 &amp; 6/);
});
test("Visual grid mutations preserve remaining cell IDs, values and alternatives", () => {
  const old = table(2),
    id = old.rows[1].cells[1].id;
  let next = editTableCell(old, {
    ...old.rows[1].cells[1],
    alternatives: ["uno"],
  });
  next = addTableRow(next);
  next = addTableColumn(next);
  next = removeTableRow(next, next.rows.at(-1)!.id);
  next = removeTableColumn(next, next.columns.at(-1)!);
  assert.equal(next.rows[1].cells[1].id, id);
  assert.deepEqual(next.rows[1].cells[1].alternatives, ["uno"]);
  assert.equal(old.rows[1].cells[1].alternatives.length, 0);
  assert.ok(
    markTableColumn(old, 1, false)
      .rows.slice(1)
      .every((row) => !row.cells[1].evaluable),
  );
  assert.equal(old.rows[0].cells[1].evaluable, false);
});
test("Table identity survives PostgreSQL JSONB object-key ordering, but detects real content or structure changes", () => {
  const old = table();
  const reorder = (v: any): any =>
    Array.isArray(v)
      ? v.map(reorder)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .reverse()
              .map((k) => [k, reorder(v[k])]),
          )
        : v;
  assert.equal(tableKey(reorder(old)), tableKey(old));
  const next = editTableCell(old, {
    ...old.rows[1].cells[1],
    html: "<p>Otra</p>",
  });
  assert.notEqual(tableKey(next), tableKey(old));
});
test("Markdown, HTML and spreadsheet pastes become visual tables with formatting rather than executable content", () => {
  const md = pastedStudyTable(
    "| Concepto | Respuesta |\n| --- | --- |\n| Mandato | **4 años** |",
  );
  assert.equal(md.headerRow, true);
  assert.match(md.rows[1].cells[1].html, /<strong>4 años/);
  const tsv = pastedStudyTable("A\tB\n1\t2");
  assert.equal(plainRichText(tsv.rows[1].cells[1].html), "2");
  const html = pastedStudyTable(
    "",
    '<table><tr><td onclick="bad()">A</td><td><em>B</em></td></tr></table>',
  );
  assert.match(html.rows[0].cells[1].html, /<em>B/);
  assert.ok(!tableHtml(html).includes("onclick"));
  assert.throws(
    () =>
      pastedStudyTable("", '<table><tr><td colspan="2">A</td></tr></table>'),
    /combinadas/,
  );
});
test("25/50/75/100 percent select only evaluable cells and have deterministic expected counts", () => {
  const t = table(20);
  for (const [pct, count] of [
    [25, 5],
    [50, 10],
    [75, 15],
    [100, 20],
  ] as const) {
    const a = createTableAttempt(t, "table", pct, () => 0.27);
    assert.equal(a.hiddenIds.length, count);
    assert.equal(new Set(a.hiddenIds).size, count);
    assert.ok(
      a.hiddenIds.every((id) => evaluableCells(t).some((c) => c.id === id)),
    );
    assert.deepEqual(
      createTableAttempt(t, "table", pct, () => 0.27),
      a,
    );
  }
  assert.equal(
    createTableAttempt(table(1), "one", 25, () => 0).hiddenIds.length,
    1,
  );
});
test("Masks remain stable on answer changes and restoration; a new combination differs whenever possible", () => {
  const t = table(8),
    a = createTableAttempt(t, "table", 50, () => 0.2);
  a.answers[a.hiddenIds[0]] = "escrita";
  const restored = restoreTableAttempt(
    t,
    "table",
    JSON.parse(JSON.stringify(a)),
  )!;
  assert.deepEqual(restored, a);
  const next = anotherTableCombination(t, a, 50, () => 0.2);
  assert.notDeepEqual(next.hiddenIds, a.hiddenIds);
  assert.equal(next.hiddenIds.length, 4);
  assert.deepEqual(next.answers, {});
});
test("Strict correction accepts case, accents and extra spaces; punctuation, negation, order and ñ remain meaningful", () => {
  assert.equal(normalizeTableAnswer("  SÍ   "), "si");
  assert.equal(normalizeTableAnswer("  CUATRO\n AÑOS "), "cuatro años");
  for (const [a, b] of [
    ["año", "ano"],
    ["12 miembros", "12"],
    ["puede", "no puede"],
    ["uno dos", "dos uno"],
    ["sí", "sí."],
  ])
    assert.notEqual(normalizeTableAnswer(a), normalizeTableAnswer(b));
});
test("Only explicitly configured answer alternatives are accepted, including shorter numeric answers", () => {
  const t = validateStudyTable(
    parseStudyTable({
      columnas: ["A", "B"],
      filas: [
        [
          "Mandato",
          {
            contenido: "4 años",
            evaluable: true,
            alternativas: ["4", "cuatro años"],
          },
        ],
      ],
    }),
  );
  for (const value of ["4", "CUATRO AÑOS", "4   años"]) {
    const a = createTableAttempt(t, "table", 100, () => 0);
    a.answers[a.hiddenIds[0]] = value;
    assert.equal(checkTable(t, a, stamp).result!.score, 10);
  }
  const a = createTableAttempt(t, "table", 100, () => 0);
  a.answers[a.hiddenIds[0]] = "cuatro";
  assert.equal(checkTable(t, a, stamp).result!.score, 0);
});
test("Score denominator contains only hidden answers; nine correct of twelve gives exactly 7.5", () => {
  const t = table(12),
    r = evaluated(t, 9).first!;
  assert.equal(r.evaluated, 12);
  assert.equal(r.score, 7.5);
  assert.equal(r.fields[0].row, 2);
  assert.equal(r.fields[0].column, 2);
  assert.equal(r.fields[0].rowLabel, "Concepto 1");
  assert.equal(r.fields[0].columnLabel, "Respuesta");
  const half = evaluated(table(20), 8, 50).first!;
  assert.equal(half.evaluated, 10);
  assert.equal(half.correct, 8);
  assert.equal(half.incorrect, 2);
  assert.equal(half.score, 8);
});
test("Blank answers and answers revealed before completion are errors and never count as successes", () => {
  const t = table(),
    a = createTableAttempt(t, "table", 100, () => 0);
  a.answers[a.hiddenIds[0]] = "1";
  const r = checkTable(t, a, stamp, true);
  assert.equal(r.first!.correct, 1);
  assert.equal(r.first!.blank, 4);
  assert.equal(r.first!.revealedWithoutAnswer, 4);
  assert.equal(r.first!.score, 2);
  assert.equal(Object.keys(r.answers).length, 1);
  assert.equal(checkTable(t, r, stamp, true).first, r.first);
});
test("Retry and changing the mask cannot replace the original score with memorized practice", () => {
  const t = table(),
    first = evaluated(t, 1);
  let a = retryTable(first);
  for (const cell of evaluableCells(t)) a.answers[cell.id] = cellAnswer(cell);
  a = checkTable(t, a, stamp);
  assert.equal(a.result!.score, 10);
  assert.equal(a.first!.score, 2);
  assert.equal(a.practiceCount, 1);
  a = anotherTableCombination(t, a, 50, () => 0.8);
  assert.equal(a.first!.score, 2);
  assert.equal(a.result, null);
  assert.equal(checkTable(t, checkTable(t, a, stamp), stamp).practiceCount, 2);
});
test("Restoration rejects changed content, foreign cards, duplicate masks and tampered results", () => {
  const t = table(),
    a = evaluated(t, 3);
  assert.equal(restoreTableAttempt(t, "other", a), null);
  assert.equal(
    restoreTableAttempt(
      editTableCell(t, { ...t.rows[1].cells[1], html: "new" }),
      "table",
      a,
    ),
    null,
  );
  assert.equal(
    restoreTableAttempt(t, "table", {
      ...a,
      hiddenIds: [a.hiddenIds[0], a.hiddenIds[0]],
    }),
    null,
  );
  assert.equal(
    restoreTableAttempt(t, "table", { ...a, first: { ...a.first, score: 10 } }),
    null,
  );
  assert.equal(prepareTableGrade(card("table", t), a).evaluation.score, 6);
});
test("Objective zero is valid only with table evidence; traditional zero and manual ratings retain old validation", () => {
  const evidence = evaluated(table(), 0).first!,
    r = review(0, "one", "one", evidence);
  assert.equal(validReviewScore(r), true);
  assert.equal(validReviewScore({ ...r, scoreSource: undefined }), false);
  assert.equal(validReviewScore({ ...r, answerEvidence: {} }), false);
  assert.throws(() => scoreRating(0));
  assert.equal(tableScoreRating(0), "again");
  assert.equal(tableScoreRating(7.5), "good");
});
test("Table means use decimal first evaluations per session; retries do not inflate averages or other cards", () => {
  const rows = [
    review(0, "s1", "a", evaluated(table(), 0).first!),
    review(10, "s1", "b", evaluated(table(), 5).first!),
    review(7.5, "s2", "c", evaluated(table(12), 9).first!),
  ];
  const index = gradeIndex(rows);
  assert.equal(index.get("table")!.average, 3.75);
  assert.equal(index.get("table")!.recallCount, 2);
  assert.equal(scoreKind(card(), index, "s1"), "reinforcement");
  const ordinary = { ...card("normal"), type: "basic" as const };
  const r: Review = {
    id: "normal",
    cardId: "normal",
    score: 5.5,
    scoreSource: "category-midpoint",
    cardSessionId: "s1",
    rating: "hard",
    correct: true,
    reviewedAt: stamp,
  };
  assert.equal(gradeIndex([...rows, r]).get("normal")!.average, 5.5);
  assert.equal(
    filterByGrade([card(), ordinary], gradeIndex([...rows, r]), {
      ...defaultGradeFilter,
      kind: "failed",
    }).length,
    1,
  );
  assert.equal(
    orderByGrade([ordinary, card()], gradeIndex([...rows, r]))[0].id,
    "table",
  );
});
test("One table is one session item and review; passed tables end and zero-score tables get existing reinforcement", () => {
  const c = card(),
    normal = { ...card("normal"), type: "basic" as const };
  let s = createCardSession([c, normal], "all", "session", now);
  assert.throws(() => answerSession(s, normal, "again", "bad", now, 0));
  s = answerSession(s, c, "again", "first", now, 0, true);
  assert.equal(s.history.length, 1);
  assert.equal(s.items.length, 2);
  assert.equal(s.items[0].status, "reinforce");
  assert.equal(nextSessionCard(s, [c, normal], now).kind, "card");
  let passed = createCardSession([c], "all", "pass", now);
  passed = answerSession(passed, c, "good", "pass-review", now, 7.5, true);
  assert.equal(sessionSummary(passed).remembered, 1);
  assert.equal(nextSessionCard(passed, [c], now).kind, "complete");
  assert.deepEqual(
    answerSession(passed, c, "good", "pass-review", now, 7.5, true),
    passed,
  );
});
test("Editing a table keeps its card ID, latest schedule, ratings-related counters and unrelated card data", () => {
  const old = card(),
    latest = {
      ...old,
      reviewCount: 20,
      fsrsStability: 50,
      dueAt: "2027-01-01T00:00:00Z",
    };
  const table2 = addTableRow(old.table!);
  const next = mergeCardContent(latest, {
    ...old,
    table: table2,
    back: tableHtml(table2),
  });
  assert.deepEqual({ ...next, table: old.table, back: old.back }, latest);
  assert.equal(next.id, old.id);
});
test("A partial table attempt survives IndexedDB, drafts, canonical checkpoints, device projection and portable JSON", async () => {
  let s = initial();
  const c = s.cards[0],
    definition = c.table!;
  let session = createCardSession(s.cards, "all", "persist-table", now);
  const attempt = createTableAttempt(definition, c.id, 50, () => 0.25);
  attempt.answers[attempt.hiddenIds[0]] = "respuesta sin terminar";
  const view = {
    queue: [
      { cardId: c.id, reason: "scheduled" as const, reinforcement: false },
    ],
    index: 0,
    revealed: false,
    selectedOption: null,
    selectedOptions: [],
    writtenAnswer: "",
    writtenResult: null,
    orthography: null,
    orthographySelected: [],
    tableAttempt: attempt,
  };
  s.settings = storeCardSession(s.settings, session, true);
  s = saveSessionPresentation(s, session.id, session.turn, view, now + 1);
  session = cardSessionById(s.settings, session.id)!;
  await writeReviewDraft(
    "table-user",
    session.id,
    session.turn,
    session.updatedAt,
    view,
  );
  assert.deepEqual(
    (await readReviewDraft("table-user", session))?.tableAttempt,
    attempt,
  );
  await transact("table-user", (a) =>
    applyLocal(a, differences(emptyState(), s, a)),
  );
  const stored = await readAccount("table-user");
  assert.ok(stored.queue.some((op) => op.kind === "cards" && op.patch.table));
  const reopened = project(stored.rows) as AppState;
  assert.deepEqual(reopened.cards[0].table, definition);
  assert.deepEqual(
    cardSessionById(reopened.settings, session.id)!.presentation!.tableAttempt,
    attempt,
  );
  const remote = await readAccount("table-device");
  mergeRemote(
    remote,
    Object.values(flatten(reopened)).map((row) => ({
      ...row,
      revision: 1,
      deleted: false,
    })),
    1,
  );
  const received = project(remote.rows) as AppState;
  assert.deepEqual(
    cardSessionById(received.settings, session.id)!.presentation!.tableAttempt,
    attempt,
  );
  assert.deepEqual(
    (
      mergeImport(
        emptyState(),
        JSON.parse(JSON.stringify(received)),
      ) as AppState
    ).cards[0].table,
    definition,
  );
  assert.equal(
    (await readAccount("table-other-user")).rows["cards:table"],
    undefined,
  );
});
test("Daily ChatGPT report includes objective zero, hidden fields, original answers and first-session classification", () => {
  const s = initial(),
    evidence = evaluated(s.cards[0].table!, 0).first!;
  s.reviews = [review(0, "report", "report", evidence)];
  const report = dailyReport(s, "2026-11-16", "Europe/Madrid");
  assert.equal(report.attempts[0].score, 0);
  assert.equal(report.attempts[0].scoreKind, "recall");
  assert.equal(report.attempts[0].answerGiven!.table!.evaluated, 5);
});
test("Existing PostgreSQL schema accepts a table, zero-grade review and resumable snapshot atomically, retaining RLS", async () => {
  const db = new PGlite(),
    owner = "11111111-1111-4111-8111-111111111111",
    other = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
    );
    await db.exec(
      await readFile("supabase/migrations/202609300001_core.sql", "utf8"),
    );
    await db.exec(
      `insert into auth.users(id) values('${owner}'),('${other}');set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`,
    );
    const c = card("table-db"),
      attempt = createTableAttempt(c.table!, c.id, 50, () => 0.4),
      evaluation = evaluated(c.table!, 0).first!;
    const ops = [
      operation("folders", "folder", {
        id: "folder",
        name: "Tema",
        parentId: null,
      }),
      operation("cards", c.id, c),
      operation("reviews", "zero", {
        ...review(0, "db-session", "zero", evaluation),
        cardId: c.id,
      }),
      operation("settings", "cardSession:db-session", {
        version: 1,
        id: "db-session",
        attempt,
      }),
    ];
    await db.query("select apply_operations($1::jsonb)", [JSON.stringify(ops)]);
    const rows = await db.query<any>("select data from cards where id=$1", [
      c.id,
    ]);
    assert.equal(rows.rows[0].data.type, "table");
    assert.equal(tableKey(rows.rows[0].data.table), tableKey(c.table!));
    assert.equal(
      (
        await db.query<any>("select data from card_reviews where id=$1", [
          "zero",
        ])
      ).rows[0].data.score,
      0,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${other}',false);`,
    );
    assert.equal((await db.query("select * from cards")).rows.length, 0);
  } finally {
    await db.close();
  }
});
