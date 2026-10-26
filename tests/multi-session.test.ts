import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { emptyState, operation } from "../lib/data/models";
import {
  applyLocal,
  differences,
  flatten,
  mergeRemote,
  project,
} from "../lib/data/projection";
import { readAccount, transact } from "../lib/data/local";
import { parseLegacy } from "../lib/data/legacy";
import {
  createCardSession,
  answerSession,
  nextSessionCard,
  type SessionPresentation,
} from "../lib/memory/session";
import {
  activeCardSession,
  savedCardSessions,
  cardSessionById,
  cardSessionKey,
  storeCardSession,
  closeCardSession,
  saveSessionPresentation,
  restoredPresentation,
} from "../lib/memory/checkpoint";
import { assignCollection } from "../lib/review/collections";
import { withdrawCollectionCard } from "../lib/review/sessionActions";
import type { AppState, Card } from "../lib/study/legacy";
const now = Date.parse("2026-10-26T10:00:00Z");
function state() {
  const s = emptyState() as AppState;
  s.cards = ["ce1", "ce2", "ley1", "ley2"].map(
    (id) =>
      ({
        id,
        folderId: "deck",
        type: "basic",
        front: id,
        back: "Respuesta",
        reviewCount: 0,
        dueAt: new Date(now).toISOString(),
      }) as Card,
  );
  s.folders = [
    {
      id: "deck",
      parentId: null,
      name: "Temario",
      color: "#285943",
      createdAt: new Date(now).toISOString(),
    },
  ];
  s.settings.activeCardSession = {
    ...createCardSession(s.cards.slice(0, 2), "learn", "ce", now),
    label: "Constitución",
  };
  return s;
}
function twoSessions() {
  const s = state();
  const second = {
    ...createCardSession(s.cards.slice(2), "all", "ley", now + 1),
    label: "Ley 40/2015",
  };
  s.settings = storeCardSession(s.settings, second, true);
  return s;
}
const view = (id: string, answer = ""): SessionPresentation => ({
  queue: [
    { cardId: id, completed: false, reinforcement: false, reason: "scheduled" },
  ],
  index: 0,
  revealed: true,
  writtenAnswer: answer,
  writtenResult: null,
  selectedOption: null,
  selectedOptions: [],
  orthography: null,
  orthographySelected: [],
});
test("Creating a second session adopts the legacy session without losing its ID, queue or history", () => {
  const s = state(),
    old = structuredClone(s.settings.activeCardSession!);
  const second = createCardSession(s.cards.slice(2), "random", "ley", now + 1);
  const settings = storeCardSession(s.settings, second, true);
  assert.deepEqual(cardSessionById(settings, "ce"), old);
  assert.deepEqual(settings[cardSessionKey("ce")], old);
  assert.equal(savedCardSessions(settings).length, 2);
  assert.equal(
    savedCardSessions({ ...settings, [cardSessionKey("bad")]: old }).length,
    2,
  );
  assert.deepEqual(s.settings.activeCardSession, old);
});
test("Checkpoints, current answers and ratings are independent even after switching the recent session", () => {
  let s = twoSessions();
  s = saveSessionPresentation(
    s,
    "ce",
    0,
    view("ce1", "Mi borrador CE"),
    now + 2,
  );
  const ce = cardSessionById(s.settings, "ce")!;
  s = saveSessionPresentation(
    s,
    "ley",
    0,
    view("ley1", "Mi borrador Ley"),
    now + 3,
  );
  assert.deepEqual(cardSessionById(s.settings, "ce"), ce);
  const next = answerSession(ce, s.cards[0], "good", "review-ce", now + 4);
  s.settings = storeCardSession(s.settings, next);
  assert.equal(cardSessionById(s.settings, "ce")!.turn, 1);
  assert.equal(
    nextSessionCard(cardSessionById(s.settings, "ce")!, s.cards, now).kind,
    "card",
  );
  assert.equal(cardSessionById(s.settings, "ley")!.turn, 0);
  assert.equal(
    restoredPresentation(cardSessionById(s.settings, "ley")!, s.cards)!
      .writtenAnswer,
    "Mi borrador Ley",
  );
  assert.equal(
    saveSessionPresentation(s, "ce", 0, view("ce1", "Borrador viejo"), now + 5),
    s,
  );
});
test("Closing one session leaves the others intact and closure survives stale record and legacy hint arrival", () => {
  const s = twoSessions(),
    ley = cardSessionById(s.settings, "ley");
  let closed = closeCardSession(s, "ce", now + 2);
  assert.deepEqual(savedCardSessions(closed.settings), [ley]);
  assert.deepEqual(cardSessionById(closed.settings, "ley"), ley);
  closed.settings.activeCardSession = s.settings[cardSessionKey("ce")];
  closed.settings = storeCardSession(
    closed.settings,
    s.settings[cardSessionKey("ce")],
  );
  assert.equal(cardSessionById(closed.settings, "ce"), null);
  assert.equal(activeCardSession(closed.settings)!.id, "ley");
  assert.equal(
    saveSessionPresentation(closed, "ce", 0, view("ce1"), now + 3),
    closed,
  );
  closed = closeCardSession(closed, "ley", now + 4);
  assert.deepEqual(savedCardSessions(closed.settings), []);
  assert.deepEqual(closed.cards, s.cards);
  assert.deepEqual(closed.reviews, s.reviews);
});
test("Independent session updates create different sync rows and concurrent offline edits retain both", () => {
  const before = twoSessions();
  const a = saveSessionPresentation(
    before,
    "ce",
    0,
    view("ce2", "CE offline"),
    now + 3,
  );
  const b = saveSessionPresentation(
    before,
    "ley",
    0,
    view("ley2", "Ley offline"),
    now + 4,
  );
  const account = {
    rows: {},
    queue: [],
    cursor: 0,
    migrated: [],
    initialized: true,
  } as Awaited<ReturnType<typeof readAccount>>;
  applyLocal(
    account,
    Object.values(flatten(before)).map((r) => operation(r.kind, r.id, r.data)),
  );
  account.queue = [];
  const aOps = differences(before, a, account),
    bOps = differences(before, b, account);
  assert.ok(aOps.some((o) => o.id === cardSessionKey("ce")));
  assert.ok(!aOps.some((o) => o.id === cardSessionKey("ley")));
  assert.ok(bOps.some((o) => o.id === cardSessionKey("ley")));
  applyLocal(account, aOps);
  const remoteB = Object.values(flatten(b)).map((r) => ({
    ...r,
    revision: 2,
    deleted: false,
  }));
  mergeRemote(account, remoteB, 2);
  const merged = project(account.rows) as AppState;
  assert.equal(
    cardSessionById(merged.settings, "ce")!.presentation!.writtenAnswer,
    "CE offline",
  );
  assert.equal(
    cardSessionById(merged.settings, "ley")!.presentation!.writtenAnswer,
    "Ley offline",
  );
  assert.equal(savedCardSessions(merged.settings).length, 2);
});
test("Two sessions survive IndexedDB reopening, sequential device handoff, backup parsing and user isolation", async () => {
  let s = twoSessions();
  s = saveSessionPresentation(
    s,
    "ce",
    0,
    view("ce2", "Continuar aquí"),
    now + 2,
  );
  s = saveSessionPresentation(s, "ley", 0, view("ley2"), now + 3);
  await transact("multi-a", (a) =>
    applyLocal(a, differences(emptyState(), s, a)),
  );
  const reopened = await readAccount("multi-a"),
    local = project(reopened.rows) as AppState;
  assert.ok(reopened.queue.length > 0);
  assert.deepEqual(
    savedCardSessions(local.settings),
    savedCardSessions(s.settings),
  );
  await transact("multi-b", (b) =>
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
  const remote = project((await readAccount("multi-b")).rows) as AppState;
  assert.deepEqual(
    savedCardSessions(remote.settings),
    savedCardSessions(local.settings),
  );
  assert.deepEqual(
    savedCardSessions(
      parseLegacy(JSON.parse(JSON.stringify(remote)))!.settings,
    ),
    savedCardSessions(s.settings),
  );
  assert.equal(
    savedCardSessions(
      project((await readAccount("multi-other-user")).rows).settings,
    ).length,
    0,
  );
});
test("Shared cards keep independent session progress and withdrawing a collection card updates every affected session", () => {
  let s = state();
  const ce = {
    ...s.settings.activeCardSession!,
    sourceCollectionId: "regular",
  };
  s.settings = storeCardSession(s.settings, ce, true);
  const ley = {
    ...createCardSession(s.cards, "all", "ley", now),
    sourceCollectionId: "regular",
  };
  s.settings = storeCardSession(s.settings, ley, true);
  s.settings = storeCardSession(
    s.settings,
    createCardSession(s.cards, "random", "other", now),
    true,
  );
  const other = cardSessionById(s.settings, "other");
  s.settings = storeCardSession(
    s.settings,
    answerSession(ce, s.cards[0], "easy", "r", now + 1),
  );
  assert.equal(cardSessionById(s.settings, "ley")!.items[0].status, "new");
  s = assignCollection(s, "regular", ["ce1"], true);
  const removed = withdrawCollectionCard(s, "regular", "ce1", now + 2);
  assert.ok(
    !cardSessionById(removed.settings, "ce")!.items.some((i) => i.id === "ce1"),
  );
  assert.ok(
    !cardSessionById(removed.settings, "ley")!.items.some(
      (i) => i.id === "ce1",
    ),
  );
  assert.deepEqual(cardSessionById(removed.settings, "other"), other);
  assert.deepEqual(removed.cards, s.cards);
  assert.equal(cardSessionById(removed.settings, "ce")!.history.length, 1);
});
test("Completed sessions remain saved until explicitly closed; no expiry or artificial session-count limit", () => {
  let s = state();
  let ce = s.settings.activeCardSession!;
  for (let i = 0; i < 2; i++)
    ce = answerSession(ce, s.cards[i], "good", "r" + i, now + i);
  s.settings = storeCardSession(s.settings, ce, true);
  assert.equal(
    nextSessionCard(ce, s.cards, now + 86400000 * 2).kind,
    "complete",
  );
  for (let i = 0; i < 20; i++)
    s.settings = storeCardSession(
      s.settings,
      createCardSession(s.cards, "learn", "extra" + i, now + i),
      true,
    );
  assert.equal(savedCardSessions(s.settings).length, 21);
  assert.equal(cardSessionById(s.settings, "ce")!.history.length, 2);
});
