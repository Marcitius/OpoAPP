import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { State } from "ts-fsrs";
import { applyFsrsReview, fsrsInput, fsrsSnapshot } from "../app/fsrs";
import {
  answerSession,
  createCardSession,
  nextSessionCard,
  sessionSummary,
  skipSessionCard,
  validSession,
} from "../lib/memory/session";
import { emptyState } from "../lib/data/models";
import {
  applyLocal,
  differences,
  project,
  mergeRemote,
  flatten,
} from "../lib/data/projection";
import { readAccount, transact } from "../lib/data/local";
import type { Card } from "../lib/study/legacy";
const t = Date.parse("2026-10-02T08:00:00Z");
export function card(id = "a"): Card {
  return {
    id,
    folderId: "folder",
    type: "basic",
    front: "Pregunta",
    back: "Respuesta",
    options: [],
    correctOption: 0,
    correctOptions: [],
    attachment: null,
    orthographyIsCorrect: null,
    orthographyCorrectForm: "",
    orthographyExplanation: "",
    orthographySource: "",
    orthographyStage: 1,
    dueAt: new Date(t).toISOString(),
    createdAt: new Date(t).toISOString(),
    lastReviewedAt: null,
    intervalDays: 0,
    ease: 2.5,
    repetitions: 0,
    lapses: 0,
    reviewCount: 0,
    successCount: 0,
    streak: 0,
    fsrsStability: 0,
    fsrsDifficulty: 0,
  };
}
function graduate(c = card()) {
  let next = applyFsrsReview(c, "good", new Date(t));
  return applyFsrsReview(next, "good", new Date(next.dueAt), true);
}
test("New Again retains Learning state and its real one-minute FSRS step", () => {
  const c = applyFsrsReview(card(), "again", new Date(t));
  assert.equal(c.fsrsState, State.Learning);
  assert.equal(Date.parse(c.dueAt) - t, 60_000);
  assert.equal(fsrsInput(c).state, State.Learning);
  assert.equal(fsrsInput(c).learning_steps, c.fsrsLearningSteps);
});
test("Every reinforcement changes FSRS while first-encounter counters remain compatible", () => {
  let c = applyFsrsReview(card(), "again", new Date(t));
  c = applyFsrsReview(c, "good", new Date(c.dueAt), true);
  assert.equal(c.fsrsReps, 2);
  assert.equal(c.reviewCount, 1);
  assert.equal(c.successCount, 0);
  assert.equal(c.fsrsState, State.Learning);
  c = applyFsrsReview(c, "good", new Date(c.dueAt), true);
  assert.equal(c.fsrsState, State.Review);
  assert.equal(c.fsrsReps, 3);
  assert.ok(c.intervalDays > 0);
});
test("Hard schedules before Good and Easy for a mature card", () => {
  const c = graduate(),
    now = new Date(c.dueAt);
  const h = applyFsrsReview(c, "hard", now),
    g = applyFsrsReview(c, "good", now),
    e = applyFsrsReview(c, "easy", now);
  assert.ok(Date.parse(h.dueAt) < Date.parse(g.dueAt));
  assert.ok(Date.parse(g.dueAt) < Date.parse(e.dueAt));
});
test("Consistent recall at due dates grows long-term intervals deterministically", () => {
  let c = graduate();
  const intervals = [c.intervalDays];
  for (let i = 0; i < 6; i++) {
    c = applyFsrsReview(c, "good", new Date(c.dueAt));
    intervals.push(c.intervalDays);
  }
  assert.ok(intervals.every((n, i) => !i || n > intervals[i - 1]));
  assert.deepEqual(
    c,
    (() => {
      let x = graduate();
      for (let i = 0; i < 6; i++)
        x = applyFsrsReview(x, "good", new Date(x.dueAt));
      return x;
    })(),
  );
});
test("Long lapse enters Relearning without deleting repetitions or legacy fields", () => {
  let c = graduate();
  for (let i = 0; i < 5; i++) c = applyFsrsReview(c, "good", new Date(c.dueAt));
  const old = structuredClone(c);
  const failed = applyFsrsReview(
    c,
    "again",
    new Date(Date.parse(c.dueAt) + 90 * 86400000),
  );
  assert.equal(failed.fsrsState, State.Relearning);
  assert.equal(failed.fsrsReps, old.fsrsReps! + 1);
  assert.equal(failed.lapses, old.lapses + 1);
  assert.equal(failed.reviewCount, old.reviewCount + 1);
  assert.ok(failed.fsrsStability > 0);
  assert.equal(failed.id, old.id);
  assert.equal(failed.front, old.front);
  assert.deepEqual(c, old);
});
test("Legacy cards adopt metadata lazily without resetting historical memory", () => {
  const c = graduate();
  delete c.fsrsState;
  delete c.fsrsLearningSteps;
  delete c.fsrsReps;
  const input = fsrsInput(c);
  assert.equal(input.state, State.Review);
  assert.equal(input.stability, c.fsrsStability);
  assert.equal(input.difficulty, c.fsrsDifficulty);
  assert.equal(input.reps, c.reviewCount);
  assert.equal(fsrsSnapshot(c).dueAt, c.dueAt);
});
test("A failed new card waits for time and intervening cards, never repeats immediately", () => {
  const cards = [card("a"), card("b"), card("c")];
  let s = createCardSession(cards, "learn", "session", t);
  cards[0] = applyFsrsReview(cards[0], "again", new Date(t));
  s = answerSession(s, cards[0], "again", "r1", t);
  assert.deepEqual(nextSessionCard(s, cards, t + 1000), {
    kind: "card",
    id: "b",
  });
  cards[1] = applyFsrsReview(cards[1], "easy", new Date(t + 1000));
  s = answerSession(s, cards[1], "easy", "r2", t + 1000);
  assert.deepEqual(nextSessionCard(s, cards, t + 65_000), {
    kind: "card",
    id: "c",
  });
  cards[2] = applyFsrsReview(cards[2], "easy", new Date(t + 65_000));
  s = answerSession(s, cards[2], "easy", "r3", t + 65_000);
  assert.deepEqual(nextSessionCard(s, cards, t + 66_000), {
    kind: "card",
    id: "a",
  });
});
test("One-card sessions wait instead of pretending a back-to-back repetition is spaced", () => {
  let c = applyFsrsReview(card(), "again", new Date(t));
  let s = answerSession(
    createCardSession([c], "learn", "one", t),
    c,
    "again",
    "r",
    t,
  );
  assert.equal(nextSessionCard(s, [c], t + 1000).kind, "waiting");
  assert.equal(nextSessionCard(s, [c], Date.parse(c.dueAt)).kind, "card");
  c = applyFsrsReview(c, "good", new Date(c.dueAt), true);
  s = answerSession(
    s,
    c,
    "good",
    "r2",
    s.items[0].eligibleAt,
  );
  assert.ok(s.items[0].attempts === 2);
});
test("Repeated failures terminate honestly as weak after six attempts, with FSRS due intact", () => {
  let c = card(),
    s = createCardSession([c], "learn", "finite", t),
    clock = t;
  for (let i = 0; i < 6; i++) {
    c = applyFsrsReview(c, "again", new Date(clock), i > 0);
    s = answerSession(s, c, "again", "r" + i, clock);
    clock = Date.parse(c.dueAt);
  }
  assert.equal(nextSessionCard(s, [c], clock).kind, "complete");
  assert.equal(sessionSummary(s).weak, 1);
  assert.equal(sessionSummary(s).remembered, 0);
  assert.equal(c.fsrsReps, 6);
  assert.equal(s.history.length, 6);
  assert.ok(Date.parse(c.dueAt) > Date.parse(c.lastReviewedAt!));
});
test("Skipping does not invent a rating, reschedule a card or claim it was learned", () => {
  const c = card(),
    s = skipSessionCard(createCardSession([c], "all", "skip", t), c.id, t);
  assert.equal(s.history.length, 0);
  assert.equal(sessionSummary(s).skipped, 1);
  assert.equal(nextSessionCard(s, [c], t).kind, "complete");
  assert.equal(c.reviewCount, 0);
});
test("Serialized checkpoint resumes the exact cooldown, attempts and queue", () => {
  const c = applyFsrsReview(card(), "again", new Date(t)),
    s = answerSession(
      createCardSession([c], "learn", "saved", t),
      c,
      "again",
      "r",
      t,
    );
  const reopened = JSON.parse(JSON.stringify(s));
  assert.ok(validSession(reopened));
  assert.deepEqual(
    nextSessionCard(reopened, [c], t + 1000),
    nextSessionCard(s, [c], t + 1000),
  );
  assert.deepEqual(reopened, s);
  assert.ok(!validSession({ version: 1, items: [{}] }));
});
test("Card + rating + session persist atomically offline through real IndexedDB and remote projection", async () => {
  const before = emptyState(),
    after = emptyState();
  const c = applyFsrsReview(card(), "again", new Date(t));
  after.folders = [
    {
      id: "folder",
      name: "Tema",
      parentId: null,
      color: "#285943",
      createdAt: new Date(t).toISOString(),
    },
  ];
  after.cards = [c];
  after.reviews = [
    {
      id: "r",
      cardId: c.id,
      rating: "again",
      correct: false,
      reviewedAt: new Date(t).toISOString(),
      reinforcement: false,
      fsrsAfter: fsrsSnapshot(c),
    },
  ];
  after.settings.activeCardSession = answerSession(
    createCardSession([c], "learn", "persist", t),
    c,
    "again",
    "r",
    t,
  );
  await transact("v12-memory", (a) =>
    applyLocal(a, differences(before, after, a)),
  );
  const local = await readAccount("v12-memory"),
    state = project(local.rows);
  assert.ok(local.queue.length >= 4);
  assert.equal(state.cards[0].fsrsState, State.Learning);
  assert.equal(state.reviews[0].rating, "again");
  assert.deepEqual(
    state.settings.activeCardSession,
    after.settings.activeCardSession,
  );
  assert.equal((await readAccount("v12-other")).rows["cards:a"], undefined);
  const remote = await readAccount("v12-remote");
  mergeRemote(
    remote,
    Object.values(flatten(state)).map((r) => ({
      ...r,
      revision: 1,
      deleted: false,
    })),
    1,
  );
  const received = project(remote.rows);
  assert.equal(received.cards[0].fsrsLearningSteps, c.fsrsLearningSteps);
  assert.deepEqual(
    received.settings.activeCardSession,
    state.settings.activeCardSession,
  );
});
