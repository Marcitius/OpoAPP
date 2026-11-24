import { test } from "node:test";
import assert from "node:assert/strict";
import {
  answerSession,
  createCardSession,
  nextSessionCard,
  retryPendingSession,
  sessionSummary,
  skipSessionCard,
} from "../lib/memory/session";
import type { CardSession } from "../lib/memory/session";
import {
  capturePriorities,
  restorePriorities,
} from "../lib/memory/reinforcement";
import { gradeIndex, orderByGrade, scoreRating } from "../lib/memory/grades";
import { previewSessionQueue } from "../lib/memory/queuePreview";
import type { Card, Review } from "../lib/study/legacy";

const t = Date.parse("2026-11-24T08:00:00Z");
// Only identity and type are inputs to the intraday scheduler; FSRS has its own fixtures.
const deck = (length: number) =>
  Array.from(
    { length },
    (_, i) => ({ id: String(i + 1), type: "basic" }) as Card,
  );
const start = (cards: Card[]): CardSession => ({
  ...createCardSession(cards, "learn", "S", t),
  grading: "scores-v1",
});
function pick(s: CardSession, cards: Card[], clock = t) {
  const n = nextSessionCard(s, cards, clock);
  return n.kind === "card" ? n.id : n.kind;
}
const answer = (s: CardSession, cards: Card[], id: string, value: number) =>
  answerSession(
    s,
    cards.find((c) => c.id === id)!,
    scoreRating(value),
    "r" + (s.turn + 1),
    t + s.turn,
    value,
  );
const grade = (
  cardId: string,
  score: number,
  session: string,
  at: number,
): Review => ({
  id: cardId + "-" + session + "-" + at,
  cardId,
  score,
  cardSessionId: session,
  scoreKind: "recall",
  rating: scoreRating(score),
  correct: score >= 5,
  reviewedAt: new Date(at).toISOString(),
});

test("Actual first return in 3, 8, 9, 10, 40, 41, 69 and 137-card selections; no clock override", () => {
  for (const [size, expected] of [
    [3, 0],
    [8, 0],
    [9, 8],
    [10, 8],
    [40, 8],
    [41, 9],
    [69, 14],
    [137, 16],
  ]) {
    const cards = deck(size);
    let s = answer(start(cards), cards, "1", 2.5);
    for (let i = 2; i <= 1 + (expected || size - 1); i++) {
      assert.equal(pick(s, cards, t + 86400000 * i), String(i));
      s = answer(s, cards, String(i), 7.5);
    }
    assert.equal(pick(s, cards, t + 1e10), expected ? "1" : "complete");
    if (!expected) {
      assert.equal(sessionSummary(s).weak, 1);
      assert.equal(pick(retryPendingSession(s, t + 1e10), cards), "1");
    }
  }
});
test("In 69 cards two automatic returns have 14 then 18 distinct answers; a third failure is parked until explicitly requested", () => {
  const cards = deck(69);
  let s = start(cards);
  const intervening = new Set<string>(),
    gaps: number[] = [];
  for (let turn = 0; turn < 100; turn++) {
    const id = pick(s, cards);
    if (id === "complete") break;
    if (id === "1") {
      gaps.push(intervening.size);
      intervening.clear();
    } else intervening.add(id);
    s = answer(s, cards, id, id === "1" ? 2.5 : 7.5);
  }
  assert.deepEqual(gaps, [0, 14, 18]);
  assert.equal(sessionSummary(s).seen, 69);
  assert.equal(s.items[0].status, "weak");
  assert.equal(pick(s, cards, t + 1e11), "complete");
  let again = retryPendingSession(s, t + 1e11);
  assert.equal(pick(again, cards), "1");
  again = answer(again, cards, "1", 5.5);
  assert.equal(sessionSummary(again).remembered, 69);
});
test("Eight skips and two days do not count as intervening answers; eight actual distinct grades do", () => {
  const cards = deck(19);
  let s = answer(start(cards), cards, "1", 2.5);
  for (let i = 2; i <= 9; i++) s = skipSessionCard(s, String(i), t + i);
  assert.equal(pick(s, cards, t + 2 * 86400000), "10");
  for (let i = 10; i <= 17; i++) {
    assert.equal(pick(s, cards), String(i));
    s = answer(s, cards, String(i), 7.5);
  }
  assert.equal(pick(s, cards), "1");
  assert.equal(s.history.length, 9);
});
test("Multiple low scores: historical independent failures beat clean history on ties, but a worse current result takes precedence", () => {
  const cards = deck(20);
  const history = [
    grade("1", 9, "old", t - 3),
    grade("2", 2, "old", t - 2),
    grade("4", 8, "old", t - 1),
  ];
  let s = capturePriorities(start(cards), gradeIndex(history));
  for (let i = 1; i <= 13; i++)
    s = answer(s, cards, String(i), i === 4 ? 1 : i <= 3 ? 2.5 : 7.5);
  assert.equal(pick(s, cards), "4");
  const noFresh = {
    ...s,
    items: s.items.map((i) =>
      i.status === "new" ? { ...i, status: "skipped" as const } : i,
    ),
  };
  let tail = answer(noFresh, cards, "4", 7.5);
  assert.equal(pick(tail, cards), "2"); // Historical 2 before unknown and historical 9.
  tail = answer(tail, cards, "2", 5);
  assert.equal(pick(tail, cards), "3");
  tail = answer(tail, cards, "3", 9);
  assert.equal(pick(tail, cards), "1");
});
test("All 69 cards failed: at least three new answers between automatic retries while unseen remain; no endless tail", () => {
  const cards = deck(69),
    seen = new Set<string>();
  let s = start(cards),
    newSince = 0,
    didRepeat = false;
  for (let step = 0; step < 220; step++) {
    const id = pick(s, cards);
    if (id === "complete") break;
    if (seen.has(id)) {
      if (seen.size < 69 && didRepeat) assert.ok(newSince >= 3);
      didRepeat = true;
      newSince = 0;
    } else {
      newSince++;
      seen.add(id);
    }
    s = answer(s, cards, id, 2.5);
    if (step === 91) assert.equal(seen.size, 69);
  }
  assert.equal(pick(s, cards), "complete");
  assert.equal(sessionSummary(s).weak, 69);
  assert.ok(
    didRepeat &&
      s.history.length <= 207 &&
      s.items.every((i) => i.attempts <= 3),
  );
});
test("A v15.5 checkpoint adopts longer gaps and only pre-session recall grades; reading it does not change the stored session or draft", () => {
  const cards = deck(12);
  let s = start(cards);
  for (let i = 1; i <= 5; i++)
    s = answer(s, cards, String(i), i === 1 ? 2.5 : 7.5);
  s.items[0].gap = 3;
  const prior = [
    grade("1", 3, "A", t - 100),
    { ...grade("1", 10, "A", t - 80), scoreKind: "reinforcement" as const },
    grade("1", 5, "B", t - 20),
    grade("1", 10, "S", t),
    grade("1", 1, "later", t + 1),
  ];
  s.presentation = {
    queue: [
      {
        cardId: "6",
        completed: false,
        reason: "scheduled",
        reinforcement: false,
      },
    ],
    index: 0,
    revealed: false,
    selectedOption: null,
    selectedOptions: [],
    writtenAnswer: "Mi borrador",
    writtenResult: null,
    orthography: null,
    orthographySelected: [],
  };
  const snapshot = JSON.stringify(s);
  const restored = restorePriorities(JSON.parse(snapshot), prior);
  assert.equal(restored.items[0].priorityScore, 4);
  assert.equal(restored.items[1].priorityScore, undefined);
  assert.deepEqual(
    [restored.id, restored.turn, restored.history, restored.presentation],
    [s.id, s.turn, s.history, s.presentation],
  );
  assert.equal(JSON.stringify(s), snapshot);
  assert.equal(pick(restored, cards, t + 1e10), "6");
  assert.deepEqual(
    previewSessionQueue(restored, cards, t, ["6"]).upcoming.map((i) => i.id),
    ["7", "8", "9", "1", "10", "11", "12"],
  );
  const stored = JSON.parse(JSON.stringify(answer(restored, cards, "6", 7.5)));
  assert.deepEqual(
    pick(stored, cards),
    pick(restorePriorities(stored, []), cards, t + 1e11),
  );
  assert.equal(stored.items[0].priorityScore, 4);
});
test("Reading an old checkpoint with four misses cannot restart an automatic loop, but explicit retry remains available", () => {
  const cards = deck(12);
  let s = start(cards);
  cards.forEach((c, i) => {
    s = answer(s, cards, c.id, i === 0 ? 2.5 : 7.5);
  });
  s.items[0] = {
    ...s.items[0],
    failures: 4,
    attempts: 4,
    status: "reinforce",
    gap: 3,
  };
  assert.equal(pick(s, cards), "complete");
  assert.equal(pick(retryPendingSession(s, t + 123), cards), "1");
});
test("A declining last independent recall breaks equal average grades; same-session practice does not mask it", () => {
  const cards = deck(3),
    rows = [
      grade("1", 2, "old", t - 3),
      grade("1", 8, "last", t - 2),
      grade("2", 8, "old", t - 3),
      grade("2", 2, "last", t - 2),
      grade("2", 10, "last", t - 1),
    ];
  const index = gradeIndex(rows);
  assert.equal(index.get("1")?.average, 5);
  assert.equal(index.get("2")?.average, 5);
  assert.deepEqual(
    orderByGrade(cards, index).map((c) => c.id),
    ["2", "1", "3"],
  );
});
test("The forecast and actual sequence agree after each grade, skip and restored checkpoint without modifying the saved trail", () => {
  const cards = deck(30);
  let s = start(cards);
  const trail: string[] = [];
  for (let n = 0; n < 65; n++) {
    const before = JSON.stringify(s),
      p = previewSessionQueue(s, cards, t);
    const id = pick(s, cards, t + 1e10);
    assert.equal(p.upcoming[0]?.id ?? "complete", id);
    assert.equal(JSON.stringify(s), before);
    if (id === "complete") break;
    trail.push(id);
    s = JSON.parse(
      JSON.stringify(
        n % 11 === 5
          ? skipSessionCard(s, id, t + n)
          : answer(s, cards, id, n % 3 ? 2.5 : 7.5),
      ),
    );
  }
  assert.ok(trail.length > 30);
});
