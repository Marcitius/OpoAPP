import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { emptyState } from "../lib/data/models";
import {
  applyLocal,
  differences,
  project,
  mergeRemote,
  flatten,
} from "../lib/data/projection";
import { readAccount, transact } from "../lib/data/local";
import { applyFsrsReview } from "../app/fsrs";
import {
  gradeIndex,
  scoreKind,
  scoreRating,
  orderByGrade,
  filterByGrade,
  defaultGradeFilter,
  RECALL_BREAK_MS,
} from "../lib/memory/grades";
import {
  answerSession,
  createCardSession,
  nextSessionCard,
  retryPendingSession,
  sessionSummary,
} from "../lib/memory/session";
import {
  closeCardSessions,
  cardSessionKey,
  closedSessionKey,
  savedCardSessions,
  storeCardSession,
  saveSessionPresentation,
} from "../lib/memory/checkpoint";
import { dailyReport, dayInZone, snapshotCard } from "../lib/reports/daily";
import type { AppState, Card, Review } from "../lib/study/legacy";
const t = Date.parse("2026-11-15T08:00:00Z");
function card(id = "a"): Card {
  return {
    id,
    folderId: "f",
    type: "basic",
    front: "<b>Pregunta</b>",
    back: "<p>Respuesta</p>",
    options: [],
    correctOption: 0,
    correctOptions: [],
    dueAt: new Date(t).toISOString(),
    createdAt: new Date(t).toISOString(),
    lastReviewedAt: null,
    intervalDays: 0,
    ease: 2.5,
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
function state(n = 1): AppState {
  const s = emptyState() as AppState;
  s.folders = [
    {
      id: "f",
      name: "Constitución",
      parentId: null,
      color: "#285943",
      createdAt: new Date(t).toISOString(),
    },
  ];
  s.cards = Array.from({ length: n }, (_, i) => card(i ? "c" + i : "a"));
  return s;
}
function review(
  id: string,
  score: number,
  at = t,
  cardId = "a",
  kind: Review["scoreKind"] = "recall",
): Review {
  return {
    id,
    cardId,
    score,
    scoreKind: kind,
    rating: scoreRating(score),
    correct: score >= 5,
    reviewedAt: new Date(at).toISOString(),
    reinforcement: kind === "reinforcement",
  };
}
test("Scores map to existing FSRS grades with five as pass; invalid scores rejected", () => {
  assert.deepEqual(
    Array.from({ length: 10 }, (_, i) => scoreRating(i + 1)),
    [
      "again",
      "again",
      "again",
      "again",
      "hard",
      "hard",
      "good",
      "good",
      "easy",
      "easy",
    ],
  );
  for (const score of [0, 11, 2.5, NaN, Infinity])
    assert.throws(() => scoreRating(score));
});
test("Every score 5–10 removes a card from this session, including Hard 5 and 6", () => {
  for (let score = 5; score <= 10; score++) {
    const c = card();
    const s = answerSession(
      createCardSession([c], "learn", "s", t),
      c,
      scoreRating(score),
      "r",
      t,
      score,
    );
    assert.equal(s.items[0].status, "remembered");
    assert.equal(nextSessionCard(s, [c], t).kind, "complete");
  }
});
test("Fail, fail, then pass records all attempts but the mean remains the initial 2", () => {
  const rows = [
    review("a", 2),
    review("b", 4, t + 60_000, "a", "reinforcement"),
    review("c", 8, t + 120_000, "a", "reinforcement"),
  ];
  const stats = gradeIndex(rows).get("a")!;
  assert.equal(stats.average, 2);
  assert.equal(stats.latest, 8);
  assert.equal(stats.latestRecall, 2);
  assert.equal(stats.recallCount, 1);
});
test("Another session, reload, or device after five minutes cannot inflate recall", () => {
  const rows = [review("first", 2)];
  const index = gradeIndex(rows);
  assert.equal(scoreKind(card(), index, t + 5 * 60_000), "reinforcement");
  rows.push(review("new-session", 10, t + 5 * 60_000, "a", "recall"));
  assert.equal(gradeIndex(rows).get("a")!.average, 2);
});
test("A later independent recall contributes once and a recent reinforcement restarts the break", () => {
  const rows = [
    review("a", 2),
    review("b", 8, t + 60_000, "a", "reinforcement"),
  ];
  assert.equal(
    scoreKind(card(), gradeIndex(rows), t + RECALL_BREAK_MS),
    "reinforcement",
  );
  const at = t + 2 * 86400_000;
  assert.equal(scoreKind(card(), gradeIndex(rows), at), "recall");
  rows.push(review("c", 4, at));
  assert.equal(gradeIndex(rows).get("a")!.average, 3);
});
test("Midnight alone never creates new recall evidence", () => {
  const before = Date.parse("2026-11-15T22:59:00Z"),
    rows = [review("a", 2, before)];
  assert.notEqual(
    dayInZone(before, "Europe/Madrid"),
    dayInZone(before + 120_000, "Europe/Madrid"),
  );
  assert.equal(
    scoreKind(card(), gradeIndex(rows), before + 120_000),
    "reinforcement",
  );
});
test("Concurrent independent submissions, duplicate IDs and event arrival order produce one mean contribution", () => {
  const a = review("a", 2),
    b = review("b", 10, t + 1);
  const result = gradeIndex([b, a, a]).get("a")!;
  assert.equal(result.average, 2);
  assert.equal(result.recallCount, 1);
  assert.equal(result.latest, 10);
});
test("Old ratings are retained without inventing a numeric grade", () => {
  const legacy: Review = {
    id: "old",
    cardId: "a",
    rating: "good",
    correct: true,
    reviewedAt: new Date(t).toISOString(),
  };
  assert.equal(gradeIndex([legacy]).get("a")!.average, null);
  assert.equal(
    scoreKind(card(), gradeIndex([legacy]), t + 1000),
    "reinforcement",
  );
});
test("Grade filters use real decimals, latest independent score and unrated separately", () => {
  const cards = [card("a"), card("b"), card("c")],
    index = gradeIndex([
      review("1", 2, t, "a"),
      review("2", 8, t + 2 * 86400_000, "a"),
      review("3", 3, t, "b"),
    ]);
  assert.deepEqual(
    filterByGrade(cards, index, { ...defaultGradeFilter, kind: "failed" }).map(
      (c) => c.id,
    ),
    ["b"],
  );
  assert.deepEqual(
    filterByGrade(cards, index, {
      ...defaultGradeFilter,
      kind: "range",
      min: 5,
      max: 7,
    }).map((c) => c.id),
    ["a"],
  );
  assert.deepEqual(
    filterByGrade(cards, index, { ...defaultGradeFilter, kind: "unrated" }).map(
      (c) => c.id,
    ),
    ["c"],
  );
  assert.deepEqual(
    filterByGrade(cards, index, {
      ...defaultGradeFilter,
      kind: "range",
      metric: "latest",
      min: 8,
      max: 8,
    }).map((c) => c.id),
    ["a"],
  );
});
test("Worst-grade ordering reserves turns for unrated cards", () => {
  const cards = [card("a"), card("b"), card("c"), card("d"), card("e")];
  const index = gradeIndex([
    review("a", 9, t, "a"),
    review("b", 2, t, "b"),
    review("c", 5, t, "c"),
  ]);
  assert.deepEqual(
    orderByGrade(cards, index).map((c) => c.id),
    ["b", "c", "d", "a", "e"],
  );
});
test("69 cards: failures are separated by distinct cards and cannot starve unseen cards", () => {
  const cards = state(69).cards;
  let s = {
    ...createCardSession(cards, "learn", "s", t),
    grading: "scores-v1" as const,
  };
  const seen = new Set<string>(),
    passed = new Set<string>();
  for (let turn = 0; turn < 110; turn++) {
    const next = nextSessionCard(s, cards, t + turn * 1000);
    if (next.kind !== "card") break;
    assert.ok(!passed.has(next.id));
    const item = s.items.find((i) => i.id === next.id)!;
    if (item.attempts) {
      assert.notEqual(s.trail?.at(-1), next.id);
      assert.ok(
        new Set(s.trail!.slice(item.lastStep).filter((id) => id !== next.id))
          .size >= 3,
      );
    }
    seen.add(next.id);
    const score = next.id === "a" ? 1 : 7;
    if (score >= 5) passed.add(next.id);
    s = answerSession(
      s,
      cards.find((c) => c.id === next.id)!,
      scoreRating(score),
      "r" + turn,
      t + turn * 1000,
      score,
    ) as typeof s;
  }
  assert.equal(seen.size, 69);
  assert.equal(passed.size, 68);
  assert.equal(sessionSummary(s).weak, 1);
});
test("Eligible failed cards are prioritized by their lowest latest score", () => {
  const cards = state(6).cards;
  let s = {
    ...createCardSession(cards, "learn", "s", t),
    grading: "scores-v1" as const,
  };
  for (let i = 0; i < 5; i++)
    s = answerSession(
      s,
      cards[i],
      scoreRating(i === 0 ? 4 : i === 1 ? 1 : 7),
      "r" + i,
      t + i * 1000,
      i === 0 ? 4 : i === 1 ? 1 : 7,
    ) as typeof s;
  assert.deepEqual(nextSessionCard(s, cards, t + 99999), {
    kind: "card",
    id: cards[1].id,
  });
});
test("A single failed card remains pending; explicit retry preserves its history and pass ends it", () => {
  const c = card();
  let s = answerSession(
    createCardSession([c], "learn", "s", t),
    c,
    "again",
    "r",
    t,
    2,
  );
  assert.equal(nextSessionCard(s, [c], t + 99999999).kind, "complete");
  assert.equal(sessionSummary(s).weak, 1);
  s = retryPendingSession(s, t + 1000);
  assert.equal(s.history.length, 1);
  assert.deepEqual(nextSessionCard(s, [c], t + 1000), {
    kind: "card",
    id: "a",
  });
  s = answerSession(s, c, "hard", "r2", t + 2000, 5);
  assert.equal(sessionSummary(s).remembered, 1);
  assert.equal(nextSessionCard(s, [c], t + 3000).kind, "complete");
});
test("Numeric grades still use deterministic FSRS; a hard correct card precedes an easy one", () => {
  let c = applyFsrsReview(card(), "good", new Date(t));
  c = applyFsrsReview(c, "good", new Date(c.dueAt), true);
  assert.ok(
    Date.parse(applyFsrsReview(c, scoreRating(5), new Date(c.dueAt)).dueAt) <
      Date.parse(applyFsrsReview(c, scoreRating(10), new Date(c.dueAt)).dueAt),
  );
  const failed = applyFsrsReview(
    c,
    scoreRating(2),
    new Date(Date.parse(c.dueAt) + 90 * 86400_000),
  );
  assert.ok(failed.fsrsReps! > c.fsrsReps!);
  assert.ok(failed.fsrsStability > 0);
  assert.ok(failed.lapses > c.lapses);
});
test("Daily JSON distinguishes first recall, recovered-after-practice, legacy and original snapshots", () => {
  const s = state();
  s.reviews = [
    review("a", 2),
    review("b", 8, t + 60_000, "a", "reinforcement"),
  ];
  s.reviews[0].cardSnapshot = snapshotCard(s, s.cards[0]);
  s.cards[0].front = "Edited later";
  const r = dailyReport(
    s,
    "2026-11-15",
    "Europe/Madrid",
    false,
    new Date(t + 100000),
  );
  assert.equal(r.summary.distinctCards, 1);
  assert.equal(r.summary.attempts, 2);
  assert.equal(r.summary.recallEvaluations, 1);
  assert.equal(r.summary.reinforcementAttempts, 1);
  assert.equal(r.summary.passedAfterReinforcement, 1);
  assert.equal(r.cards[0].averageRecall, 2);
  assert.equal(r.attempts[0].content!.question, "Pregunta");
  assert.equal(r.attempts[0].contentSource, "at-attempt");
  assert.equal(r.summary.activeStudyTimeMs, null);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(r)));
});
test("Historical daily means exclude future grades and optional planning is explicitly current", () => {
  const s = state();
  s.reviews = [review("a", 2), review("b", 10, t + 2 * 86400_000)];
  const r = dailyReport(
    s,
    "2026-11-15",
    "Europe/Madrid",
    true,
    new Date(t + 3 * 86400_000),
  );
  assert.equal(r.cards[0].averageRecall, 2);
  assert.equal(r.planningContext!.scope, "current-state-at-export");
  assert.ok(
    !("planningContext" in dailyReport(s, "2026-11-15", "Europe/Madrid")),
  );
});
test("Daily boundaries handle the 25-hour daylight-saving day without losing offline events", () => {
  const s = state();
  s.reviews = [
    review("a", 2, Date.parse("2026-10-24T22:30:00Z")),
    review("b", 4, Date.parse("2026-10-25T22:30:00Z")),
    review("c", 8, Date.parse("2026-10-25T23:30:00Z"), "a", "reinforcement"),
  ];
  assert.equal(
    dailyReport(s, "2026-10-25", "Europe/Madrid").summary.attempts,
    2,
  );
  assert.equal(
    dailyReport(s, "2026-10-26", "Europe/Madrid").summary.attempts,
    1,
  );
  assert.throws(() => dailyReport(s, "2026-02-31", "Europe/Madrid"));
});
test("Bulk closing selected/all sessions is idempotent, preserves ratings and archives unfinished results", () => {
  let s = state(2);
  for (const id of ["one", "two", "three"])
    s.settings = storeCardSession(
      s.settings,
      createCardSession(s.cards, "learn", id, t),
    );
  s.reviews = [review("r", 2)];
  const next = closeCardSessions(s, ["one", "two", "two", "missing"], t + 1);
  assert.deepEqual(
    savedCardSessions(next.settings).map((s) => s.id),
    ["three"],
  );
  assert.equal(next.reviews, s.reviews);
  assert.equal(next.cards, s.cards);
  assert.deepEqual(next.settings["finishedCardSession:one"].pendingCardIds, [
    "a",
    "c1",
  ]);
  const all = closeCardSessions(next, ["three"], t + 2);
  assert.equal(savedCardSessions(all.settings).length, 0);
  assert.equal(closeCardSessions(all, ["one"], t + 999), all);
});
test("A stale checkpoint cannot reopen a bulk-closed session", () => {
  let s = state();
  s.settings = storeCardSession(
    s.settings,
    createCardSession(s.cards, "learn", "s", t),
  );
  s = closeCardSessions(s, ["s"], t + 1);
  const p = {
    queue: [],
    index: 0,
    revealed: false,
    selectedOption: null,
    selectedOptions: [],
    writtenAnswer: "stale",
    writtenResult: null,
    orthography: null,
    orthographySelected: [],
  };
  assert.equal(saveSessionPresentation(s, "s", 0, p, t + 2), s);
});
test("Notes, original answers and bulk closures survive offline outbox, reload, remote projection and portable JSON", async () => {
  const before = emptyState() as AppState,
    next = state();
  next.reviews = [
    {
      ...review("r", 2),
      cardSnapshot: snapshotCard(next, next.cards[0]),
      answerEvidence: { text: "Mi respuesta" },
    },
  ];
  next.settings = storeCardSession(
    next.settings,
    createCardSession(next.cards, "learn", "s", t),
  );
  let account = await transact("score-account-a", (a) =>
    applyLocal(a, differences(before, next, a)),
  );
  assert.ok(
    account.queue.some((o) => o.kind === "reviews" && o.patch.score === 2),
  );
  const reopened = project(
    (await readAccount("score-account-a")).rows,
  ) as AppState;
  assert.equal(gradeIndex(reopened.reviews).get("a")!.average, 2);
  const closed = closeCardSessions(reopened, ["s"], t + 10);
  account = await transact("score-account-a", (a) =>
    applyLocal(a, differences(reopened, closed, a)),
  );
  const other = await readAccount("score-account-b");
  assert.equal(project(other.rows).reviews.length, 0);
  const remote = await readAccount("score-device-b");
  const rows = Object.values(account.rows).map((row) => ({
    ...row,
    revision: 1,
  }));
  mergeRemote(remote, rows, 1);
  const received = project(remote.rows) as AppState;
  assert.equal(savedCardSessions(received.settings).length, 0);
  assert.ok(received.settings[closedSessionKey("s")]);
  assert.equal(received.reviews[0].answerEvidence!.text, "Mi respuesta");
  assert.deepEqual(
    JSON.parse(JSON.stringify(received)).reviews,
    received.reviews,
  );
  assert.equal(
    dailyReport(received, "2026-11-15", "Europe/Madrid").summary.attempts,
    1,
  );
});

test("Daily report keeps canonical reinforcement consistent and never labels independent recall as immediate recovery", () => {
  const s = state();
  s.reviews = [review("a", 2), review("b", 8, t + 1)];
  let report = dailyReport(s, "2026-11-15", "Europe/Madrid");
  assert.equal(report.attempts[1].scoreKind, "reinforcement");
  assert.equal(report.attempts[1].reinforcement, true);
  assert.equal(report.cards[0].averageRecall, 2);
  s.reviews = [review("a", 2), review("b", 8, t + 13 * 3600000)];
  report = dailyReport(s, "2026-11-15", "Europe/Madrid");
  assert.equal(report.summary.recallEvaluations, 2);
  assert.equal(report.summary.passedAfterReinforcement, 0);
  assert.equal(report.cards[0].averageRecall, 5);
});
