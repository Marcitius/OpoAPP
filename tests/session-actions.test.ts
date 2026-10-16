import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import type { Card, AppState } from "../lib/study/legacy";
import { emptyState } from "../lib/data/models";
import { assignCollection, inCollection } from "../lib/review/collections";
import {
  mergeCardContent,
  withdrawCollectionCard,
} from "../lib/review/sessionActions";
import {
  createCardSession,
  nextSessionCard,
  validSession,
} from "../lib/memory/session";
import { applyLocal, differences, project } from "../lib/data/projection";
import { readAccount, transact } from "../lib/data/local";
const now = Date.parse("2026-10-16T12:00:00Z");
function card(id: string): Card {
  return {
    id,
    folderId: "deck",
    type: "basic",
    front: "Pregunta",
    back: "Respuesta",
    options: [],
    correctOption: 0,
    correctOptions: [],
    dueAt: "2027-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    lastReviewedAt: null,
    intervalDays: 20,
    ease: 0,
    repetitions: 8,
    lapses: 2,
    streak: 3,
    reviewCount: 12,
    successCount: 10,
    attachment: null,
    fsrsStability: 23,
    fsrsDifficulty: 5,
    fsrsState: 2,
    fsrsLearningSteps: 0,
    fsrsReps: 12,
    orthographyIsCorrect: null,
    orthographyCorrectForm: "",
    orthographyExplanation: "",
    orthographySource: "",
    orthographyStage: 1,
  };
}
function state(): AppState {
  const s = emptyState() as AppState;
  s.folders = [
    {
      id: "deck",
      name: "Tema",
      parentId: null,
      color: "#285943",
      createdAt: new Date(now).toISOString(),
    },
  ];
  s.cards = [card("one"), card("two")];
  s.reviews = [
    {
      id: "old-review",
      cardId: "one",
      rating: "again",
      correct: false,
      reviewedAt: new Date(now - 10000).toISOString(),
    },
  ];
  s.settings.activeCardSession = {
    ...createCardSession(s.cards, "learn", "session", now),
    sourceCollectionId: "regular",
    history: [{ cardId: "one", rating: "again", reviewId: "old-review" }],
  };
  return assignCollection(
    assignCollection(s, "regular", ["one", "two"], true),
    "mal",
    ["one"],
    true,
  );
}
test("editar contenido conserva el scheduling mas reciente y la identidad", () => {
  const original = card("one");
  const latest = {
    ...original,
    reviewCount: 22,
    fsrsStability: 47,
    fsrsReps: 22,
    dueAt: "2027-03-01T00:00:00Z",
  };
  const edited = {
    ...original,
    front: "Pregunta corregida",
    back: "Respuesta corregida",
    options: ["A", "B"],
    folderId: "destination",
  };
  const actual = mergeCardContent(latest, edited);
  assert.deepEqual(actual, {
    ...latest,
    front: edited.front,
    back: edited.back,
    options: edited.options,
    folderId: edited.folderId,
  });
  assert.throws(() => mergeCardContent(latest, { ...edited, id: "other" }));
});
test("retirar de una coleccion no borra tarjetas, historial ni otras colecciones", () => {
  const before = state();
  before.settings.activeCardSession!.items[0] = {
    ...before.settings.activeCardSession!.items[0],
    status: "reinforce",
    attempts: 2,
    eligibleAt: now + 60000,
  };
  const after = withdrawCollectionCard(before, "regular", "one", now);
  assert.equal(inCollection(after.settings, "regular", "one"), false);
  assert.equal(inCollection(after.settings, "mal", "one"), true);
  assert.equal(inCollection(before.settings, "regular", "one"), true);
  assert.deepEqual(after.cards, before.cards);
  assert.deepEqual(after.reviews, before.reviews);
  assert.deepEqual(
    after.settings.activeCardSession!.history,
    before.settings.activeCardSession!.history,
  );
  assert.deepEqual(
    nextSessionCard(after.settings.activeCardSession!, after.cards, now),
    { kind: "card", id: "two" },
  );
});
test("retirar la ultima tarjeta finaliza sin inventar una valoracion", () => {
  let s = withdrawCollectionCard(state(), "regular", "one", now);
  s = withdrawCollectionCard(s, "regular", "two", now);
  assert.equal(
    nextSessionCard(s.settings.activeCardSession!, s.cards, now).kind,
    "complete",
  );
  assert.equal(s.reviews.length, 1);
  assert.equal(s.settings.activeCardSession!.history.length, 1);
});
test("una retirada no altera una sesion de otra coleccion ni una sesion antigua", () => {
  const before = state();
  before.settings.activeCardSession!.sourceCollectionId = "mal";
  assert.deepEqual(
    withdrawCollectionCard(before, "regular", "one", now).settings
      .activeCardSession,
    before.settings.activeCardSession,
  );
  delete before.settings.activeCardSession!.sourceCollectionId;
  assert.ok(validSession(before.settings.activeCardSession));
  assert.deepEqual(
    withdrawCollectionCard(before, "regular", "one", now).settings
      .activeCardSession,
    before.settings.activeCardSession,
  );
});
test("edicion y retirada offline persisten juntas con origen e historial tras reabrir", async () => {
  const before = emptyState();
  let after = state();
  after.cards = after.cards.map((c) =>
    c.id === "two" ? mergeCardContent(c, { ...c, front: "Texto nuevo" }) : c,
  );
  after = withdrawCollectionCard(after, "regular", "one", now);
  await transact("v131-actions", (a) =>
    applyLocal(a, differences(before, after, a)),
  );
  const account = await readAccount("v131-actions");
  const loaded = project(account.rows) as AppState;
  assert.ok(account.queue.length > 0);
  assert.equal(loaded.cards.find((c) => c.id === "two")?.front, "Texto nuevo");
  assert.equal(loaded.settings.activeCardSession!.sourceCollectionId, "regular");
  assert.equal(inCollection(loaded.settings, "regular", "one"), false);
  assert.deepEqual(loaded.reviews, after.reviews);
  assert.deepEqual(
    loaded.settings.activeCardSession,
    after.settings.activeCardSession,
  );
});
