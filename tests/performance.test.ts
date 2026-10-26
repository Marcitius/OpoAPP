import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  project,
  differences,
  applyLocal,
  flatten,
} from "../lib/data/projection";
import {
  project as originalProject,
  differences as originalDifferences,
} from "./fixtures/projection-v14.1";
import { emptyAccount, emptyState, type LegacyState } from "../lib/data/models";
import { shareJson, orderedDueCards } from "../lib/memory/performance";
import {
  fitPersonalMemoryModel,
  predictPersonalRecall,
} from "../app/memoryModel";
import { createCardSession } from "../lib/memory/session";
import {
  matchingReviewDraft,
  writeReviewDraft,
  readReviewDraft,
  reviewDraftKey,
} from "../lib/memory/draft";
import { readValue } from "../lib/data/local";
import type { AppState, Card } from "../lib/study/legacy";
const now = Date.parse("2026-10-26T10:00:00Z");
const cleanOps = (ops: ReturnType<typeof differences>) =>
  ops.map(({ op_id, txn_id, created_at, ...rest }) => rest);
function sample(count = 35): LegacyState {
  const s = emptyState();
  s.folders = [
    {
      id: "deck",
      name: "Tema",
      parentId: null,
      createdAt: new Date(now).toISOString(),
    },
  ];
  s.cards = Array.from({ length: count }, (_, i) => ({
    id: "c" + i,
    folderId: "deck",
    type: i % 7 === 0 ? "orthography" : "basic",
    front: "Pregunta " + i,
    back: "Texto ".repeat(100),
    reviewCount: i % 5,
    successCount: i % 4,
    dueAt: new Date(now + ((i % 3) - 1) * 86400000).toISOString(),
    fsrsStability: 1 + i,
    fsrsDifficulty: 5,
    lastReviewedAt: new Date(now - 86400000).toISOString(),
  }));
  s.reviews = Array.from({ length: count * 4 }, (_, i) => ({
    id: "r" + i,
    cardId: "c" + (i % count),
    correct: i % 3 !== 0,
    reinforcement: i % 5 === 0,
    rating: i % 3 ? "good" : "again",
    predictedRecall: 0.8,
    reviewedAt: new Date(now - i * 1000).toISOString(),
  }));
  return s;
}
test("Indexed review counters are identical to v14.1, including reinforcement, absolute counters and deleted rows", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const s = sample(seed * 3),
      a = emptyAccount();
    applyLocal(a, differences(emptyState(), s, a));
    Object.values(a.rows).forEach((r, i) => {
      if (i % 19 === 0) r.deleted = true;
    });
    assert.deepEqual(project(a.rows), originalProject(a.rows));
  }
});
test("Optimized differences retain exact patches, deletes and orders for edits, imports, settings, and task completions", () => {
  const before = sample(),
    a = emptyAccount();
  applyLocal(a, originalDifferences(emptyState(), before, a));
  const nexts = [
    { ...before, settings: { ...before.settings, draft: { answer: "hola" } } },
    {
      ...before,
      cards: before.cards.map((c, i) =>
        i === 2 ? { ...c, back: "editado", options: ["a", "b"] } : c,
      ),
    },
    { ...before, cards: before.cards.slice(2).reverse() },
    JSON.parse(JSON.stringify(before)),
    { ...before, cards: [...before.cards, { ...before.cards[0], id: "new" }] },
    {
      ...before,
      studyNodes: [{ id: "n", name: "N", parentId: null }],
      studyTasks: [
        {
          id: "t",
          nodeId: "n",
          status: "done",
          completedAt: new Date(now).toISOString(),
          assessment: "bien",
          _completionEventId: "fixed",
        },
      ],
    },
  ];
  for (const next of nexts)
    assert.deepEqual(
      cleanOps(differences(before, next, a)),
      cleanOps(originalDifferences(before, next, a)),
    );
});
test("Settings checkpoint does not visit unchanged card payloads; cloned-but-equal collections still compare correctly", () => {
  const before = sample(),
    a = emptyAccount();
  let reads = 0;
  for (const card of before.cards) {
    const text = card.back;
    Object.defineProperty(card, "back", {
      get() {
        reads++;
        return text;
      },
      enumerable: true,
    });
  }
  differences(before, { ...before, settings: { ...before.settings, x: 1 } }, a);
  assert.equal(reads, 0);
  const clone = JSON.parse(JSON.stringify(before));
  assert.deepEqual(
    cleanOps(differences(before, clone, a)),
    cleanOps(originalDifferences(before, clone, a)),
  );
});
test("Structural sharing preserves unchanged branches, handles deletes/reorders and safe imported keys without mutation", () => {
  const before = sample(),
    next = JSON.parse(JSON.stringify(before));
  next.settings.x = 1;
  const shared = shareJson(before, next);
  assert.equal(shared.cards, before.cards);
  assert.equal(shared.reviews, before.reviews);
  assert.notEqual(shared.settings, before.settings);
  assert.deepEqual(shared, next);
  next.cards[0].back = "different";
  const edit = shareJson(shared, next);
  assert.notEqual(edit.cards, shared.cards);
  assert.equal(edit.cards[1], shared.cards[1]);
  assert.equal(shared.cards[0].back, before.cards[0].back);
  assert.deepEqual(shareJson([1, 2], [2, 1]), [2, 1]);
  assert.deepEqual(shareJson({ a: 1, b: 2 }, { a: 1 }), { a: 1 });
  const malicious = JSON.parse('{"__proto__":{"polluted":true}}');
  const safe = shareJson({}, malicious);
  assert.ok(Object.hasOwn(safe, "__proto__"));
  assert.equal(({} as any).polluted, undefined);
});
test("Cached due-card scores preserve the exact previous queue order", () => {
  const s = sample(90) as AppState,
    model = fitPersonalMemoryModel(s.cards, s.reviews),
    date = new Date(now);
  const expected = s.cards
    .filter(
      (c) =>
        c.type !== "orthography" &&
        c.reviewCount > 0 &&
        Date.parse(c.dueAt) <= now,
    )
    .sort(
      (a, b) =>
        predictPersonalRecall(a, s.reviews, model, date).probability -
        predictPersonalRecall(b, s.reviews, model, date).probability,
    );
  assert.deepEqual(orderedDueCards(s.cards, s.reviews, model, date), expected);
});
test("Small draft survives IndexedDB reopening, is account/session scoped and rejects old turn or remote revision", async () => {
  const s = sample() as AppState,
    session = createCardSession(s.cards, "learn", "saved", now);
  const p = {
    queue: [
      {
        cardId: "c1",
        completed: false,
        reinforcement: false,
        reason: "scheduled" as const,
      },
    ],
    index: 0,
    revealed: false,
    selectedOption: 1,
    selectedOptions: [1, 2],
    writtenAnswer: "Última respuesta",
    writtenResult: null,
    orthography: null,
    orthographySelected: [],
  };
  await writeReviewDraft(
    "draft-user-a",
    session.id,
    session.turn,
    session.updatedAt,
    p,
  );
  assert.deepEqual(await readReviewDraft("draft-user-a", session), p);
  assert.equal(await readReviewDraft("draft-user-b", session), null);
  assert.equal(
    await readReviewDraft("draft-user-a", { ...session, turn: 1 }),
    null,
  );
  assert.equal(
    await readReviewDraft("draft-user-a", {
      ...session,
      updatedAt: new Date(now + 1).toISOString(),
    }),
    null,
  );
  const draft = await readValue<any>(
    "legacy",
    reviewDraftKey("draft-user-a", session.id),
  );
  assert.equal(matchingReviewDraft(draft, { ...session, id: "other" }), null);
});
