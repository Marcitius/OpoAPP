import { test } from "node:test";
import assert from "node:assert/strict";
import type { Card, StudyMode } from "../lib/study/legacy";
import {
  createCardSession,
  answerSession,
  nextSessionCard,
  retryPendingSession,
  skipSessionCard,
} from "../lib/memory/session";
import { previewSessionQueue } from "../lib/memory/queuePreview";
import {
  createCardSearchIndex,
  cardSearchText,
  searchCards,
  cardSearchExcerpt,
} from "../lib/study/cardSearch";
import { parseStudyTable } from "../lib/tables/model";

const now = Date.parse("2026-11-19T08:00:00Z");
const card = (id: string, type: Card["type"] = "basic"): Card => ({
  id,
  type,
  folderId: "folder",
  front: `<p>Pregunta ${id}</p>`,
  back: `<p>Respuesta ${id}</p>`,
  options: [],
  correctOption: 0,
  correctOptions: [],
  dueAt: new Date(now).toISOString(),
  createdAt: new Date(now).toISOString(),
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
});
const pool = (n = 8) =>
  Array.from({ length: n }, (_, i) => card(String(i + 1)));
const freeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
};

test("Queue preview uses the real next-card choice and preserves selected order in every ordinary mode", () => {
  const cards = pool();
  for (const mode of [
    "learn",
    "random",
    "all",
    "weakest",
    "recommended",
    "grades",
  ] as StudyMode[]) {
    const session = createCardSession(cards, mode, "session", now);
    const result = previewSessionQueue(session, cards, now);
    const next = nextSessionCard(session, cards, now);
    assert.equal(next.kind, "card");
    if (next.kind === "card") assert.equal(result.upcoming[0].id, next.id);
    assert.deepEqual(
      result.upcoming.map((x) => x.id),
      cards.map((x) => x.id),
    );
  }
});
test("A suspended card in a set of ten moves behind eight distinct answers; a pass removes it from the forecast", () => {
  const cards = pool(10);
  let s = {
    ...createCardSession(cards, "learn", "session", now),
    grading: "scores-v1" as const,
  };
  s = answerSession(s, cards[0], "again", "r1", now, 2.5) as typeof s;
  assert.deepEqual(
    previewSessionQueue(s, cards, now, ["2"]).upcoming.map((x) => x.id),
    ["3", "4", "5", "6", "7", "8", "9", "1", "10"],
  );
  for (const i of [1, 2, 3, 4, 5, 6, 7, 8])
    s = answerSession(s, cards[i], "good", `r${i + 1}`, now, 7.5) as typeof s;
  assert.deepEqual(nextSessionCard(s, cards, now), { kind: "card", id: "1" });
  s = answerSession(s, cards[0], "good", "retry", now, 7.5) as typeof s;
  const result = previewSessionQueue(s, cards, now);
  assert.ok(!result.upcoming.some((x) => x.id === "1"));
  assert.ok(result.approved.some((x) => x.id === "1"));
});
test("The ready reinforcement forecast uses the scheduler's numeric priority, including objective zero", () => {
  const cards = [card("high"), card("zero", "table"), card("decimal")];
  const base = createCardSession(cards, "learn", "s", now);
  const s = {
    ...base,
    grading: "scores-v1" as const,
    items: base.items.map((x, i) => ({
      ...x,
      status: "reinforce" as const,
      attempts: 1,
      lastScore: [4, 0, 2.5][i],
      gap: 0,
    })),
  };
  assert.equal(previewSessionQueue(s, cards, now).upcoming[0].id, "zero");
  assert.deepEqual(nextSessionCard(s, cards, now), {
    kind: "card",
    id: "zero",
  });
});
test("Insufficient separation and skipped cards remain pending; an explicit retry makes them available", () => {
  const cards = pool(1);
  let s = createCardSession(cards, "learn", "s", now);
  s = answerSession(s, cards[0], "again", "r1", now, 2.5);
  let view = previewSessionQueue(s, cards, now);
  assert.equal(view.upcoming.length, 0);
  assert.equal(view.held[0].id, "1");
  view = previewSessionQueue(retryPendingSession(s, now), cards, now);
  assert.equal(view.upcoming[0].id, "1");
  assert.equal(
    previewSessionQueue(skipSessionCard(s, "1", now), cards, now).held[0]
      .status,
    "skipped",
  );
});
test("Opening or projecting a queue cannot mutate grades, sessions, presentation, tables or card data", () => {
  const cards = pool(6);
  let s = createCardSession(cards, "learn", "s", now);
  s = answerSession(s, cards[0], "again", "real-review", now, 2.5);
  const snapshot = JSON.stringify({ s, cards });
  freeze(s);
  freeze(cards);
  for (let i = 0; i < 4; i++) previewSessionQueue(s, cards, now, ["2"], 4);
  assert.equal(JSON.stringify({ s, cards }), snapshot);
  assert.equal(s.history.length, 1);
  assert.equal(s.history[0].reviewId, "real-review");
});
test("Queue lookahead is paged without losing cards or treating the unrequested remainder as blocked", () => {
  const cards = pool(137),
    s = createCardSession(cards, "all", "s", now);
  const first = previewSessionQueue(s, cards, now, ["1"]);
  assert.equal(first.upcoming.length, 30);
  assert.equal(first.hasMore, true);
  assert.equal(first.held.length, 0);
  const all = previewSessionQueue(s, cards, now, ["1"], 200);
  assert.equal(all.upcoming.length, 136);
  assert.equal(all.hasMore, false);
  const removed = previewSessionQueue(s, cards.slice(0, 5), now);
  assert.equal(removed.missing, 132);
  assert.equal(removed.upcoming.length, 5);
});
test("Orthography retains its time-based eligibility and does not invent a future date to populate the preview", () => {
  const cards = [card("word", "orthography")];
  const base = createCardSession(cards, "learn", "s", now);
  const s = {
    ...base,
    format: "orthography" as const,
    items: base.items.map((x) => ({
      ...x,
      status: "reinforce" as const,
      eligibleAt: now + 60000,
      gap: 0,
    })),
  };
  const view = previewSessionQueue(s, cards, now);
  assert.equal(view.waiting, true);
  assert.equal(view.upcoming.length, 0);
  assert.equal(view.held.length, 1);
  assert.equal(
    previewSessionQueue(s, cards, now + 60001).upcoming[0].id,
    "word",
  );
});
test("The same checkpoint forecasts the same queue after reload, handoff or a long pause in ordinary study", () => {
  const cards = pool();
  let s = createCardSession(cards, "learn", "s", now);
  s = answerSession(s, cards[0], "again", "r", now, 2.5);
  assert.deepEqual(
    previewSessionQueue(s, cards, now, ["2"]),
    previewSessionQueue(
      JSON.parse(JSON.stringify(s)),
      JSON.parse(JSON.stringify(cards)),
      now + 86400000,
      ["2"],
    ),
  );
});
test("Global search finds rich-text questions and answers across all types, ignoring case and accents", () => {
  assert.equal(
    cardSearchText(
      "<p><strong>Con</strong>stituci&oacute;n &#xE1; &ntilde;</p><script>ignorar()</script>",
    ),
    "Constitución á ñ",
  );
  const cards = (
    [
      "basic",
      "test",
      "choice",
      "written",
      "table",
      "orthography",
    ] as Card["type"][]
  ).map((type, i) => ({
    ...card(String(i), type),
    front: `<p>Enunciado <strong>Constitución ${i}</strong></p>`,
    back: `<p>Respuesta exclusiva ${i} · <em>Secretaría</em></p>`,
  }));
  const index = createCardSearchIndex(cards);
  assert.equal(searchCards(index, "  SECRETARIA ").length, 6);
  assert.equal(searchCards(index, "constitucion 4")[0].card.type, "table");
  assert.equal(searchCards(index, "strong").length, 0);
});
test("Search indexes actual choice answers and explicit table answers, without exposing encoded written rubrics or unrelated distractors", () => {
  const testCard = {
    ...card("test", "test"),
    back: "",
    options: ["Congreso exclusivo", "Distractor secreto", "Otro", "Ninguno"],
    correctOptions: [0],
  };
  const written = {
    ...card("written", "written"),
    options: ["OPGC_RUBRIC_ID_INTERNO"],
    back: "<p>Concepto escrito visible</p>",
  };
  const table = {
    ...card("table", "table"),
    table: parseStudyTable({
      columnas: ["Dato", "Valor"],
      filas: [
        [
          "Mandato",
          {
            contenido: "Cuatro años de mandato",
            respuesta: "4",
            evaluable: true,
            alternativas: ["cuatrienio"],
          },
        ],
      ],
    }),
  };
  const index = createCardSearchIndex([testCard, written, table]);
  assert.equal(searchCards(index, "congreso exclusivo")[0].card.id, "test");
  assert.equal(searchCards(index, "cuatrienio")[0].card.id, "table");
  assert.equal(searchCards(index, "OPGC_RUBRIC_ID_INTERNO").length, 0);
  assert.equal(searchCards(index, "Distractor secreto").length, 0);
});
test("Search combines words across question and answer, returns a card only once, and keeps a useful match excerpt", () => {
  const c = {
    ...card("a"),
    front: "<p>Órgano representativo</p>",
    back: `<p>${"Contexto ".repeat(80)}secretario final</p>`,
  };
  const index = createCardSearchIndex([c]);
  assert.equal(searchCards(index, "organo secretario").length, 1);
  assert.equal(searchCards(index, " ").length, 0);
  assert.match(cardSearchExcerpt(index[0].answer, "secretario"), /secretario/);
  assert.equal(
    searchCards(
      createCardSearchIndex([{ ...c, back: "Cambio nuevo" }]),
      "secretario",
    ).length,
    0,
  );
});
test("A large library uses a bounded initial queue and can find an answer at the end of its local index", () => {
  const cards = pool(2200);
  cards[2199] = {
    ...cards[2199],
    back: "<p>Hallazgo al final de la biblioteca</p>",
  };
  const s = createCardSession(cards, "all", "s", now);
  assert.equal(previewSessionQueue(s, cards, now).upcoming.length, 30);
  assert.equal(
    searchCards(createCardSearchIndex(cards), "hallazgo biblioteca")[0].card.id,
    "2200",
  );
});
