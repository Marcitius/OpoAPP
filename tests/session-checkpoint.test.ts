import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { State } from "ts-fsrs";
import { applyFsrsReview } from "../app/fsrs";
import {
  createCardSession,
  answerSession,
  nextSessionCard,
  sessionSummary,
  upgradeCardSession,
  interleaveNewCards,
  skipSessionCard,
  type SessionPresentation,
} from "../lib/memory/session";
import {
  activeCardSession,
  closeCardSession,
  closedSessionKey,
  saveSessionPresentation,
  restoredPresentation,
} from "../lib/memory/checkpoint";
import { emptyState } from "../lib/data/models";
import {
  applyLocal,
  differences,
  project,
  mergeRemote,
  flatten,
} from "../lib/data/projection";
import { readAccount, transact } from "../lib/data/local";
import type { AppState, Card, Rating } from "../lib/study/legacy";
const now = Date.parse("2026-10-20T10:00:00Z");
function card(id: string): Card {
  return {
    id,
    folderId: "folder",
    type: "basic",
    front: id,
    back: "Respuesta",
    options: [],
    correctOptions: [],
    correctOption: 0,
    attachment: null,
    orthographyIsCorrect: null,
    orthographyCorrectForm: "",
    orthographyExplanation: "",
    orthographySource: "",
    orthographyStage: 1,
    dueAt: new Date(now).toISOString(),
    createdAt: new Date(now).toISOString(),
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
function state(count = 10): AppState {
  const s = emptyState() as AppState;
  s.folders = [
    {
      id: "folder",
      name: "Constitución",
      parentId: null,
      color: "#285943",
      createdAt: new Date(now).toISOString(),
    },
  ];
  s.cards = Array.from({ length: count }, (_, i) => card("c" + i));
  s.settings.activeCardSession = createCardSession(s.cards, "learn", "s", now);
  return s;
}
const view = (ids = ["c0"]): SessionPresentation => ({
  queue: ids.map((cardId) => ({
    cardId,
    reinforcement: false,
    reason: "scheduled",
    completed: false,
  })),
  index: ids.length - 1,
  revealed: false,
  selectedOption: null,
  selectedOptions: [],
  writtenAnswer: "",
  writtenResult: null,
  orthography: null,
  orthographySelected: [],
});

test("Bien and Fácil finish the card for this session even while FSRS still says Learning", () => {
  for (const rating of ["good", "easy"] as Rating[]) {
    const c = applyFsrsReview(card("a"), rating, new Date(now));
    const s = answerSession(
      createCardSession([c], "learn", rating, now),
      c,
      rating,
      "r",
      now,
    );
    assert.equal(s.items[0].status, "remembered");
    assert.equal(nextSessionCard(s, [c], now + 2 * 86400000).kind, "complete");
    assert.equal(
      c.fsrsState,
      rating === "good" ? State.Learning : State.Review,
    );
    assert.ok(Date.parse(c.dueAt) > now);
  }
});
test("69 cards: long pauses never starve unseen cards; reinforcement has distinct spacing and a finite bound", () => {
  const cards = state(69).cards;
  let s = createCardSession(cards, "all", "69", now),
    step = 0,
    lastRepeat = -100;
  const last = new Map<string, number>(),
    trail: string[] = [];
  while (step < 300) {
    const next = nextSessionCard(s, cards, now + step * 3600000);
    if (next.kind !== "card") break;
    const previous = last.get(next.id),
      unseen = s.items.some((i) => i.status === "new");
    if (previous !== undefined) {
      assert.notEqual(trail.at(-1), next.id);
      assert.ok(new Set(trail.slice(previous + 1)).size >= 8);
      if (unseen) assert.ok(step - lastRepeat >= 4);
      lastRepeat = step;
    }
    last.set(next.id, step);
    trail.push(next.id);
    s = answerSession(
      s,
      cards.find((c) => c.id === next.id)!,
      "again",
      "r" + step,
      now + step * 3600000,
    );
    step++;
  }
  assert.equal(sessionSummary(s).seen, 69);
  assert.ok(step <= 69 * 3);
  assert.equal(nextSessionCard(s, cards, now + 20 * 86400000).kind, "complete");
  assert.ok(s.items.every((i) => i.attempts <= 3));
  assert.ok(new Set(trail.slice(0, 92)).size === 69);
});
test("A five-minute or two-day pause cannot bypass separation; good cards never return", () => {
  const cards = state(10).cards;
  let s = answerSession(
    createCardSession(cards, "all", "s", now),
    cards[0],
    "again",
    "r0",
    now,
  );
  for (let i = 1; i < 8; i++)
    s = answerSession(s, cards[i], "good", "r" + i, now + i);
  assert.deepEqual(nextSessionCard(s, cards, now + 300000), {
    kind: "card",
    id: "c8",
  });
  assert.deepEqual(nextSessionCard(s, cards, now + 2 * 86400000), {
    kind: "card",
    id: "c8",
  });
  s = answerSession(s, cards[8], "easy", "r8", now + 8);
  assert.deepEqual(nextSessionCard(s, cards, now + 9), {
    kind: "card",
    id: "c0",
  });
  s = answerSession(s, cards[0], "good", "r9", now + 9);
  assert.deepEqual(nextSessionCard(s, cards, now + 10), {
    kind: "card",
    id: "c9",
  });
  s = answerSession(s, cards[9], "good", "r10", now + 10);
  assert.equal(nextSessionCard(s, cards, now + 2 * 86400000).kind, "complete");
});
test("Difícil has at most one later check; duplicate or completed ratings do not change the session", () => {
  const cards = state(10).cards;
  let s = createCardSession(cards, "all", "hard", now);
  s = answerSession(s, cards[0], "hard", "r0", now);
  for (let i = 1; i < 9; i++)
    s = answerSession(s, cards[i], "good", "r" + i, now + i);
  assert.deepEqual(nextSessionCard(s, cards, now + 9), {
    kind: "card",
    id: "c0",
  });
  s = answerSession(s, cards[0], "hard", "r9", now + 9);
  assert.equal(s.items[0].status, "weak");
  assert.equal(s.items[0].attempts, 2);
  assert.equal(answerSession(s, cards[0], "good", "r10", now + 10), s);
  assert.equal(answerSession(s, cards[1], "good", "r1", now + 11), s);
});
test("Skipped cards count as distinct intervening content without inventing ratings", () => {
  const cards = state(3).cards;
  let s = answerSession(
    createCardSession(cards, "all", "skip", now),
    cards[0],
    "again",
    "r",
    now,
  );
  s = skipSessionCard(s, "c1", now + 1);
  s = skipSessionCard(s, "c2", now + 2);
  assert.deepEqual(nextSessionCard(s, cards, now + 3), {
    kind: "card",
    id: "c0",
  });
  assert.equal(s.history.length, 1);
  assert.equal(s.turn, 3);
});
test("Old checkpoints adopt Good/Easy completion without resetting IDs, attempts or history", () => {
  const s = createCardSession(state(3).cards, "learn", "legacy", now);
  delete s.algorithmVersion;
  delete s.trail;
  s.history = [{ cardId: "c0", rating: "good", reviewId: "old" }];
  s.items[0] = {
    ...s.items[0],
    attempts: 1,
    status: "reinforce",
    lastRating: "good",
  };
  const upgraded = upgradeCardSession(s);
  assert.equal(upgraded.id, s.id);
  assert.deepEqual(upgraded.history, s.history);
  assert.equal(upgraded.items[0].status, "remembered");
  assert.equal(upgraded.items[0].attempts, 1);
  assert.deepEqual(nextSessionCard(upgraded, state(3).cards, now), {
    kind: "card",
    id: "c1",
  });
});
test("Recommended order interleaves fresh cards; explicit session modes retain selection order", () => {
  const [a, b, c, d, e] = state(5).cards;
  a.reviewCount = b.reviewCount = c.reviewCount = 1;
  assert.deepEqual(
    interleaveNewCards([a, b, c, d, e]).map((c) => c.id),
    [a.id, b.id, d.id, c.id, e.id],
  );
  assert.deepEqual(
    createCardSession([e, c, a], "all", "ordered", now).items.map((i) => i.id),
    [e.id, c.id, a.id],
  );
});
test("Checkpoint preserves exact card, face, written draft, choices and past queue", () => {
  const s = state(),
    p = {
      ...view(["c0", "c1"]),
      revealed: true,
      writtenAnswer: "Mi respuesta",
      selectedOption: 2,
      selectedOptions: [0, 2],
    };
  const next = saveSessionPresentation(s, "s", 0, p, now);
  const saved = activeCardSession(next.settings)!;
  assert.deepEqual(restoredPresentation(saved, next.cards), p);
  assert.equal(sessionSummary(saved).seen, 2);
  assert.equal(saved.history.length, 0);
  assert.deepEqual(s.cards, next.cards);
  assert.deepEqual(
    restoredPresentation(JSON.parse(JSON.stringify(saved)), next.cards),
    p,
  );
});
test("Delayed drafts cannot overwrite a rating, close or replace a session", () => {
  const s = state();
  s.settings.activeCardSession = answerSession(
    s.settings.activeCardSession!,
    s.cards[0],
    "good",
    "r",
    now,
  );
  assert.equal(saveSessionPresentation(s, "s", 0, view(), now), s);
  const closed = closeCardSession(s, "s", now);
  assert.equal(activeCardSession(closed.settings), null);
  assert.equal(saveSessionPresentation(closed, "s", 1, view(), now), closed);
  closed.settings.activeCardSession = createCardSession(
    s.cards,
    "all",
    "other",
    now,
  );
  assert.equal(saveSessionPresentation(closed, "s", 0, view(), now), closed);
  assert.equal(
    closeCardSession(closed, "s", now).settings.activeCardSession!.id,
    "other",
  );
});
test("Offline checkpoint survives IndexedDB reopen and sequential handoff through existing projection", async () => {
  const before = emptyState();
  const saved = saveSessionPresentation(
    state(),
    "s",
    0,
    {
      ...view(["c0", "c1"]),
      revealed: true,
      writtenAnswer: "Borrador offline",
    },
    now,
  );
  await transact("v132-device-a", (a) =>
    applyLocal(a, differences(before, saved, a)),
  );
  const reopened = await readAccount("v132-device-a"),
    local = project(reopened.rows) as AppState;
  assert.ok(reopened.queue.length > 0);
  assert.equal(
    restoredPresentation(activeCardSession(local.settings)!, local.cards)!
      .writtenAnswer,
    "Borrador offline",
  );
  await transact("v132-device-b", (b) =>
    mergeRemote(
      b,
      Object.values(flatten(local)).map((r) => ({
        ...r,
        revision: 1,
        deleted: false,
      })),
      1,
    ),
  );
  const received = project(
    (await readAccount("v132-device-b")).rows,
  ) as AppState;
  assert.deepEqual(
    activeCardSession(received.settings),
    activeCardSession(local.settings),
  );
  assert.equal(
    activeCardSession(
      (project((await readAccount("v132-other-user")).rows) as AppState)
        .settings,
    ),
    null,
  );
});
test("Separate closure marker prevents an old offline session snapshot from reappearing", async () => {
  const s = saveSessionPresentation(state(), "s", 0, view(), now),
    closed = closeCardSession(s, "s", now + 1);
  const device = await readAccount("v132-closure");
  mergeRemote(
    device,
    Object.values(flatten(closed)).map((r) => ({
      ...r,
      revision: 1,
      deleted: false,
    })),
    1,
  );
  const stale = flatten(s)["settings:activeCardSession"];
  mergeRemote(device, [{ ...stale, revision: 2, deleted: false }], 2);
  const received = project(device.rows) as AppState;
  assert.ok(received.settings[closedSessionKey("s")]);
  assert.equal(activeCardSession(received.settings), null);
  assert.deepEqual(received.cards, s.cards);
});
test("Orthography retains the previous time-based learning and correct-answer steps", () => {
  const c = applyFsrsReview(
    { ...card("ortho"), type: "orthography" as const },
    "good",
    new Date(now),
  );
  let s = {
    ...createCardSession([c], "learn", "ortho", now),
    format: "orthography" as const,
  };
  s = answerSession(s, c, "good", "r", now) as typeof s;
  assert.equal(s.items[0].status, "reinforce");
  assert.equal(nextSessionCard(s, [c], now + 1000).kind, "waiting");
  assert.equal(nextSessionCard(s, [c], Date.parse(c.dueAt)).kind, "card");
});
test("Deleting content while paused drops obsolete references without erasing past ratings", () => {
  let s = state(3);
  s.settings.activeCardSession = answerSession(
    s.settings.activeCardSession!,
    s.cards[0],
    "good",
    "history",
    now,
  );
  const p = view(["c0", "c1"]);
  s = saveSessionPresentation(s, "s", 1, p, now);
  s.cards = s.cards.filter((c) => c.id !== "c0");
  const restored = restoredPresentation(
    activeCardSession(s.settings)!,
    s.cards,
  )!;
  assert.equal(restored.index, 0);
  assert.equal(restored.queue[0].cardId, "c1");
  s = saveSessionPresentation(s, "s", 1, restored, now);
  assert.equal(activeCardSession(s.settings)!.items.length, 2);
  assert.equal(activeCardSession(s.settings)!.history[0].reviewId, "history");
  s.cards = s.cards.filter((c) => c.id !== "c1");
  assert.equal(
    restoredPresentation(activeCardSession(s.settings)!, s.cards),
    null,
  );
});
