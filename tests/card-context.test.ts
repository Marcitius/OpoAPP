import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import type { AppState, Card, Review } from "../lib/study/legacy";
import { emptyAccount, emptyState } from "../lib/data/models";
import {
  applyLocal,
  differences,
  project,
  mergeRemote,
} from "../lib/data/projection";
import { parseLegacy, validateState } from "../lib/data/legacy";
import { readAccount, transact } from "../lib/data/local";
import {
  cardNotes,
  saveCardNote,
  changeCardNote,
  noteEvents,
} from "../lib/cards/notes";
import {
  saveDerivedCard,
  sourceNeedsReview,
  acknowledgeDerivedSource,
} from "../lib/cards/derived";
import { deleteCards } from "../lib/cards/delete";
import { cardContentKey, snapshotCard } from "../lib/cards/context";
import {
  createCardSession,
  nextSessionCard,
  answerSession,
} from "../lib/memory/session";
import {
  cardSessionById,
  storeCardSession,
  saveSessionPresentation,
} from "../lib/memory/checkpoint";
import { gradeIndex } from "../lib/memory/grades";
import { dailyReport } from "../lib/reports/daily";
import { mergeCardContent } from "../lib/review/sessionActions";
import {
  defaultWrittenRubric,
  completeWrittenRubric,
} from "../lib/cards/written";
import { canSelfAcceptTable } from "../lib/cards/selfReview";
import { parseStudyTable } from "../lib/tables/model";
import {
  createTableAttempt,
  checkTable,
  retryTable,
} from "../lib/tables/learning";
const at = "2026-11-23T10:00:00.000Z",
  now = Date.parse(at);
function card(id: string): Card {
  return {
    id,
    folderId: "deck",
    type: "basic",
    front: `<p>Pregunta ${id}</p>`,
    back: "<p>Respuesta con una condición</p>",
    options: [],
    correctOption: 0,
    correctOptions: [],
    dueAt: at,
    createdAt: at,
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
function fixture(): AppState {
  const s = emptyState() as AppState;
  s.folders = [
    {
      id: "deck",
      name: "Tema",
      parentId: null,
      color: "#285943",
      createdAt: at,
    },
  ];
  s.cards = Array.from({ length: 6 }, (_, i) => card("c" + i));
  s.settings = storeCardSession(
    s.settings,
    {
      ...createCardSession(s.cards, "learn", "ses", now),
      grading: "scores-v1",
    },
    true,
  );
  return s;
}
function review(
  id: string,
  session: string,
  score: number,
  extra: Partial<Review> = {},
): Review {
  return {
    id,
    cardId: "c0",
    cardSessionId: session,
    score,
    scoreKind: "recall",
    rating: score < 5 ? "again" : "good",
    correct: score >= 5,
    reviewedAt: at,
    ...extra,
  };
}
test("optional notes retain card content and grades; edits/resolution have immutable daily events", () => {
  const s = fixture(),
    before = structuredClone(s);
  let n = saveCardNote(
    s,
    { id: "n", cardId: "c0", text: " Olvido quién decide ", sessionId: "ses" },
    "e1",
    at,
  );
  assert.deepEqual(n.cards, before.cards);
  assert.deepEqual(n.reviews, before.reviews);
  n = saveCardNote(
    n,
    { id: "n", cardId: "c0", text: "Olvido la mayoría" },
    "e2",
    at,
  );
  n = changeCardNote(n, "n", "resolve", "e3", at);
  assert.equal(cardNotes(n.settings, "c0")[0].resolvedAt, at);
  assert.equal(
    noteEvents(n.settings).find((e) => e.id === "e1")?.note.text,
    "Olvido quién decide",
  );
  assert.equal(
    cardNotes(changeCardNote(n, "n", "reopen", "e4", at).settings)[0]
      .resolvedAt,
    null,
  );
  assert.deepEqual(s, before);
});
test("blank notes and missing cards are rejected without creating records", () => {
  assert.throws(() =>
    saveCardNote(fixture(), { id: "n", cardId: "c0", text: "  " }, "e", at),
  );
  assert.throws(() =>
    saveCardNote(
      fixture(),
      { id: "n", cardId: "missing", text: "Nota" },
      "e",
      at,
    ),
  );
});
test("notes on unrated cards are exported for the exact local day, including midnight boundaries", () => {
  let s = saveCardNote(
    fixture(),
    { id: "n1", cardId: "c0", text: "Sin calificar" },
    "e1",
    "2026-11-22T23:30:00.000Z",
  );
  s = saveCardNote(
    s,
    { id: "n2", cardId: "c1", text: "Día siguiente" },
    "e2",
    "2026-11-23T23:10:00.000Z",
  );
  const r = dailyReport(s, "2026-11-23", "Europe/Madrid");
  assert.equal(r.attempts.length, 0);
  assert.equal(r.notesActivity.length, 1);
  assert.equal(r.notesActivity[0].note.text, "Sin calificar");
  assert.equal(r.summary.notesWritten, 1);
});
test("notes persist offline in IDB and remain isolated between accounts", async () => {
  const s = saveCardNote(
    fixture(),
    { id: "n", cardId: "c0", text: "Persistente" },
    "e",
    at,
  );
  await transact("notes-user", (a) =>
    applyLocal(a, differences(emptyState(), s, a)),
  );
  assert.equal(
    cardNotes(
      (project((await readAccount("notes-user")).rows) as AppState).settings,
    )[0].text,
    "Persistente",
  );
  assert.equal(
    cardNotes(
      (project((await readAccount("notes-other")).rows) as AppState).settings,
    ).length,
    0,
  );
});
test("notes written concurrently on different devices merge as separate records", () => {
  const s = fixture(),
    a = emptyAccount();
  applyLocal(a, differences(emptyState(), s, a));
  const left = saveCardNote(
    s,
    { id: "left", cardId: "c0", text: "Quién" },
    "el",
    at,
  );
  const right = saveCardNote(
    s,
    { id: "right", cardId: "c0", text: "Cuánto" },
    "er",
    at,
  );
  applyLocal(a, differences(s, left, a));
  const remote = emptyAccount();
  applyLocal(remote, differences(s, right, remote));
  mergeRemote(
    a,
    Object.values(remote.rows).map((r) => ({ ...r, revision: 100 })),
    100,
  );
  assert.equal(cardNotes((project(a.rows) as AppState).settings).length, 2);
});
test("derived cards get new identity, their source relation and independent progress", () => {
  const s = fixture(),
    old = structuredClone(s);
  const next = saveDerivedCard(s, card("child"), "c0", at, "ses", false, "n");
  const child = next.cards.at(-1)!;
  assert.equal(child.derivation?.sourceCardId, "c0");
  assert.equal(child.derivation?.noteId, "n");
  assert.deepEqual(next.cards[0], old.cards[0]);
  assert.equal(child.reviewCount, 0);
  assert.equal(cardSessionById(next.settings, "ses")!.items.length, 6);
  assert.equal(
    dailyReport(next, "2026-11-23", "Europe/Madrid").derivedCardsCreated.length,
    1,
  );
  assert.throws(() => saveDerivedCard(next, child, "c0", at));
});
test("source edits flag derivatives, while reordering/notes/remote progress do not", () => {
  const s = saveDerivedCard(fixture(), card("child"), "c0", at),
    child = s.cards.at(-1)!;
  assert.equal(sourceNeedsReview(child, s.cards), false);
  assert.equal(
    cardContentKey({
      ...s.cards[0],
      reviewCount: 30,
      folderId: "other",
      sortOrder: 80,
    }),
    cardContentKey(s.cards[0]),
  );
  assert.equal(
    sourceNeedsReview(child, [{ ...s.cards[0], back: "Cambio" }, child]),
    true,
  );
  const latest = { ...child, reviewCount: 30 };
  assert.deepEqual(
    mergeCardContent(latest, { ...child, front: "Editada" }).derivation,
    child.derivation,
  );
  const changed = {
    ...s,
    cards: s.cards.map((c) =>
      c.id === "c0" ? { ...c, back: "Cambio concurrente" } : c,
    ),
  };
  assert.equal(
    sourceNeedsReview(
      saveDerivedCard(
        changed,
        card("child2"),
        "c0",
        at,
        undefined,
        false,
        undefined,
        s.cards[0],
      ).cards.at(-1)!,
      changed.cards,
    ),
    true,
  );
});
test("reviewing a changed derivative clears its warning without replacing content or grades", () => {
  const s = saveDerivedCard(fixture(), card("child"), "c0", at);
  s.cards[0] = { ...s.cards[0], back: "Nueva condición" };
  const old = structuredClone(s.cards.at(-1)!);
  assert.equal(sourceNeedsReview(old, s.cards), true);
  const next = acknowledgeDerivedSource(s, "child");
  assert.equal(sourceNeedsReview(next.cards.at(-1)!, next.cards), false);
  assert.equal(next.cards.at(-1)!.back, old.back);
  assert.equal(next.cards.at(-1)!.reviewCount, old.reviewCount);
  assert.deepEqual(next.reviews, s.reviews);
});
test("guided derivative practice interleaves distinct cards and survives checkpoint serialization", () => {
  const s = saveDerivedCard(fixture(), card("child"), "c0", at, "ses", true);
  let session = cardSessionById(JSON.parse(JSON.stringify(s.settings)), "ses")!;
  assert.equal(session.items.at(-1)?.guidedPractice, true);
  for (let i = 0; i < 3; i++) {
    const pick = nextSessionCard(session, s.cards, now);
    assert.equal(pick.kind, "card");
    if (pick.kind !== "card") throw Error();
    assert.notEqual(pick.id, "child");
    session = answerSession(
      session,
      s.cards.find((c) => c.id === pick.id)!,
      "good",
      "r" + i,
      now + i,
      7.5,
    );
  }
  assert.deepEqual(nextSessionCard(session, s.cards, now), {
    kind: "card",
    id: "child",
  });
});
test("guided practice does not count in mean, a later independent session does", () => {
  const history = [
    review("a", "guided", 10, {
      learningContext: "derived-guided",
      scoreKind: "reinforcement",
    }),
    review("b", "guided", 9.5, { learningContext: "derived-guided" }),
    review("c", "new", 5.5),
  ];
  const stats = gradeIndex(history).get("c0")!;
  assert.equal(stats.average, 5.5);
  assert.equal(stats.recallCount, 1);
  assert.equal(stats.recallIds.has("a"), false);
});
test("deleting current card cleans all saved queues and memberships; history/notes/children survive", () => {
  let s = saveDerivedCard(fixture(), card("child"), "c0", at);
  s = saveCardNote(s, { id: "n", cardId: "c0", text: "Debilidad" }, "e", at);
  s.reviews = [
    review("r", "old", 3, { cardSnapshot: snapshotCard(s, s.cards[0]) }),
  ];
  const session = cardSessionById(s.settings, "ses")!;
  s.settings = storeCardSession(s.settings, {
    ...session,
    presentation: {
      queue: [
        {
          cardId: "c0",
          completed: false,
          reinforcement: false,
          reason: "scheduled",
        },
      ],
      index: 0,
      revealed: false,
      selectedOption: null,
      selectedOptions: [],
      writtenAnswer: "borrador",
      writtenResult: null,
      orthography: null,
      orthographySelected: [],
    },
  });
  s.settings = storeCardSession(
    s.settings,
    createCardSession(s.cards, "learn", "other", now),
  );
  s.settings["reviewMembership:next:c0"] = true;
  const result = deleteCards(s, ["c0"], at);
  assert.equal(
    result.cards.some((c) => c.id === "c0"),
    false,
  );
  assert.equal(
    result.cards.some((c) => c.id === "child"),
    true,
  );
  for (const id of ["ses", "other"])
    assert.equal(
      cardSessionById(result.settings, id)!.items.some((i) => i.id === "c0"),
      false,
    );
  assert.deepEqual(result.reviews, s.reviews);
  assert.equal(cardNotes(result.settings, "c0").length, 1);
  assert.equal(result.settings["reviewMembership:next:c0"], false);
  assert.equal(
    saveSessionPresentation(
      result,
      "ses",
      session.turn,
      session.presentation!,
      now,
    ),
    result,
  );
  assert.equal(
    dailyReport(result, "2026-11-23", "Europe/Madrid").notesActivity.length,
    1,
  );
});
test("portable JSON after deletion restores reviews and emits only a deleted-card tombstone", () => {
  const s = fixture();
  s.reviews = [review("r", "old", 5)];
  const deleted = deleteCards(s, ["c0"], at);
  const restored = parseLegacy(JSON.stringify(deleted))!;
  validateState(restored);
  const a = emptyAccount(),
    ops = differences(emptyState(), restored, a);
  const tombstone = ops.find((op) => op.kind === "cards" && op.id === "c0")!;
  assert.equal(tombstone.deleted, true);
  assert.equal(tombstone.patch.front, s.cards[0].front);
  applyLocal(a, ops);
  const projection = project(a.rows);
  assert.equal(
    projection.cards.some((c) => c.id === "c0"),
    false,
  );
  assert.equal(projection.reviews.length, 1);
  assert.equal(a.rows["cards:c0"].deleted, true);
});
test("deleting the only card leaves an empty resumable session without a fake score", () => {
  const s = fixture();
  s.cards = [s.cards[0]];
  s.settings = storeCardSession(
    s.settings,
    createCardSession(s.cards, "learn", "single", now),
  );
  const deleted = deleteCards(s, ["c0"], at),
    session = cardSessionById(deleted.settings, "single")!;
  assert.deepEqual(nextSessionCard(session, deleted.cards, now), {
    kind: "complete",
  });
  assert.equal(session.history.length, 0);
  assert.equal(deleted.reviews.length, 0);
});
test("written creation reuses exact rubric encoding, fills only empty initial criterion", () => {
  const rubric = defaultWrittenRubric();
  const completed = completeWrittenRubric(
    rubric,
    "<p>Mayoría <strong>absoluta</strong></p>",
    true,
  )!;
  assert.equal(completed.criterios[0].esperado, "Mayoría absoluta");
  assert.equal(rubric.criterios[0].esperado, "");
  assert.equal(completeWrittenRubric(completed, "Otra", true), completed);
  assert.equal(completeWrittenRubric(rubric, "Otra", false), rubric);
});
test("manual table acceptance cannot promote blanks, revealed answers or subsequent practice", () => {
  const table = parseStudyTable({
    columnas: ["Concepto", "Respuesta"],
    filas: [["Duración", { contenido: "4 años", evaluable: true }]],
  });
  const empty = createTableAttempt(table, "table", 100, () => 0.1);
  assert.equal(canSelfAcceptTable(undefined), false);
  assert.equal(canSelfAcceptTable(checkTable(table, empty, at)), false);
  const answered = {
    ...empty,
    answers: Object.fromEntries(
      empty.hiddenIds.map((id) => [id, "Cuatro años"]),
    ),
  };
  const checked = checkTable(table, answered, at);
  assert.equal(checked.first?.score, 0);
  assert.equal(canSelfAcceptTable(checked), true);
  assert.equal(canSelfAcceptTable(checkTable(table, empty, at, true)), false);
  assert.equal(
    canSelfAcceptTable(checkTable(table, retryTable(checked), at)),
    false,
  );
  assert.deepEqual(checked.answers, answered.answers);
});
test("manual self-reviewed grade preserves objective failure and feeds decimals without rewriting history", () => {
  const r = review("manual", "manual-session", 10, {
    scoreSource: "self-reviewed",
    accuracy: 20,
    answerEvidence: {
      objectiveCorrect: false,
      selfReview: {
        acceptedAt: at,
        automaticScore: 2,
        source: "student-confirmed",
      },
    },
  });
  const s = fixture();
  s.reviews = [r, review("next", "another-session", 5.5)];
  assert.equal(gradeIndex(s.reviews).get("c0")!.average, 7.75);
  const report = dailyReport(s, "2026-11-23", "Europe/Madrid");
  assert.equal(
    report.attempts.find((v) => v.id === "manual")!.scoreSource,
    "self-reviewed",
  );
  assert.equal(
    report.attempts.find((v) => v.id === "manual")!.answerGiven?.selfReview
      ?.automaticScore,
    2,
  );
});
test("SQL restores deleted-card reviews atomically with existing constraints and unchanged schema", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { readFile } = await import("node:fs/promises");
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
    );
    await db.exec(
      await readFile("supabase/migrations/202609300001_core.sql", "utf8"),
    );
    const user = "77777777-7777-4777-8777-777777777777";
    await db.exec(
      `insert into auth.users(id) values('${user}');set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`,
    );
    const s = fixture();
    s.reviews = [review("r", "ses", 7.5)];
    const copy = deleteCards(
      saveCardNote(s, { id: "n", cardId: "c0", text: "Nota" }, "e", at),
      ["c0"],
      at,
    );
    const ops = differences(emptyState(), copy, emptyAccount());
    await db.query("select public.apply_operations($1::jsonb)", [
      JSON.stringify(ops),
    ]);
    const deleted = await db.query<any>(
      "select deleted_at from cards where id='c0'",
    );
    assert.ok(deleted.rows[0].deleted_at);
    assert.equal(
      (await db.query<any>("select data from card_reviews where id='r'"))
        .rows[0].data.score,
      7.5,
    );
    assert.equal(
      (
        await db.query<any>(
          "select data from user_settings where id='cardNote:n'",
        )
      ).rows[0].data.value.text,
      "Nota",
    );
  } finally {
    await db.close();
  }
});

test("source fingerprints are stable after JSONB key reordering in tables and attachments", () => {
  const s = card("source");
  s.type = "table";
  s.table = parseStudyTable({
    columnas: ["Concepto", "Respuesta"],
    filas: [["Duración", { contenido: "4 años", evaluable: true }]],
  });
  const reversed = (value: any): any =>
    Array.isArray(value)
      ? value.map(reversed)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .reverse()
              .map(([k, v]) => [k, reversed(v)]),
          )
        : value;
  assert.equal(cardContentKey(s), cardContentKey(reversed(s)));
});
