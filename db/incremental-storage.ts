import { getD1 } from "@/db";
import { type AppState, saveState as saveStateSnapshot } from "./storage";

type ActiveSettings = {
  activeSync: string;
  stateVersion: number;
  dailyReviewGoal: number;
  dailyNewLimit: number;
  seedVersion: number;
};

type ExistingFolder = {
  id: string;
  position: number;
  name: string;
  color: string;
  parentId: string | null;
  createdAt: string;
};

type ExistingCard = {
  id: string;
  position: number;
  folderId: string;
  type: string;
  front: string;
  back: string;
  optionsJson: string;
  correctOption: number;
  correctOptionsJson: string;
  dueAt: string;
  createdAt: string;
  lastReviewedAt: string | null;
  intervalDays: number;
  ease: number;
  repetitions: number;
  lapses: number;
  streak: number;
  reviewCount: number;
  successCount: number;
  attachmentId: string | null;
  attachmentKey: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSize: number | null;
  attachmentUrl: string | null;
  fsrsStability: number;
  fsrsDifficulty: number;
  orthographyIsCorrect: number | null;
  orthographyCorrectForm: string | null;
  orthographyExplanation: string | null;
  orthographySource: string | null;
  orthographyStage: number;
};

type ExistingReview = { id: string };

type ExistingPsych = {
  id: string;
  position: number;
  name: string;
  category: string;
  totalQuestions: number;
  attachmentId: string | null;
  attachmentKey: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSize: number | null;
  attachmentUrl: string | null;
  createdAt: string;
};

type ExistingAttempt = {
  id: string;
  psychTestId: string;
  position: number;
  date: string;
  correct: number;
  wrong: number;
  blank: number;
  score: number;
  minutes: number;
  notes: string;
};

type WriteCounts = {
  folders: number;
  cards: number;
  reviews: number;
  psychTests: number;
  psychAttempts: number;
  deletions: number;
};

const json = (value: unknown) => JSON.stringify(value ?? []);
const number = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const text = (value: unknown) => value == null ? "" : String(value);
const nullableText = (value: unknown) => value == null ? null : String(value);

function sameValues(a: readonly unknown[], b: readonly unknown[]) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function incomingCardValues(card: AppState["cards"][number], existing?: ExistingCard) {
  // If an older overlapping save arrives after a newer review save, never move the
  // long-term memory counters backwards. Content/folder edits are still allowed.
  const incomingReviewCount = number(card.reviewCount);
  const keepExistingStudyState = Boolean(existing && number(existing.reviewCount) > incomingReviewCount);

  return {
    folderId: card.folderId,
    type: card.type,
    front: card.front,
    back: card.back,
    optionsJson: json(card.options),
    correctOption: number(card.correctOption),
    correctOptionsJson: json(card.correctOptions ?? [card.correctOption]),
    dueAt: keepExistingStudyState ? existing!.dueAt : card.dueAt,
    createdAt: card.createdAt,
    lastReviewedAt: keepExistingStudyState ? existing!.lastReviewedAt : card.lastReviewedAt,
    intervalDays: keepExistingStudyState ? number(existing!.intervalDays) : number(card.intervalDays),
    ease: keepExistingStudyState ? number(existing!.ease) : number(card.ease),
    repetitions: keepExistingStudyState ? number(existing!.repetitions) : number(card.repetitions),
    lapses: keepExistingStudyState ? number(existing!.lapses) : number(card.lapses),
    streak: keepExistingStudyState ? number(existing!.streak) : number(card.streak),
    reviewCount: keepExistingStudyState ? number(existing!.reviewCount) : incomingReviewCount,
    successCount: keepExistingStudyState ? number(existing!.successCount) : number(card.successCount),
    attachmentId: card.attachment?.id ?? null,
    attachmentKey: card.attachment?.key ?? null,
    attachmentName: card.attachment?.name ?? null,
    attachmentType: card.attachment?.type ?? null,
    attachmentSize: card.attachment?.size ?? null,
    attachmentUrl: card.attachment?.url ?? null,
    fsrsStability: keepExistingStudyState ? number(existing!.fsrsStability) : number(card.fsrsStability),
    fsrsDifficulty: keepExistingStudyState ? number(existing!.fsrsDifficulty) : number(card.fsrsDifficulty),
    orthographyIsCorrect: typeof card.orthographyIsCorrect === "boolean" ? (card.orthographyIsCorrect ? 1 : 0) : null,
    orthographyCorrectForm: card.orthographyCorrectForm ?? "",
    orthographyExplanation: card.orthographyExplanation ?? "",
    orthographySource: card.orthographySource ?? "",
    orthographyStage: Math.max(1, number(card.orthographyStage, 1)),
  };
}

function cardComparable(row: ExistingCard) {
  return [
    row.folderId, row.type, row.front, row.back, row.optionsJson, number(row.correctOption), row.correctOptionsJson,
    row.dueAt, row.createdAt, row.lastReviewedAt, number(row.intervalDays), number(row.ease), number(row.repetitions),
    number(row.lapses), number(row.streak), number(row.reviewCount), number(row.successCount),
    nullableText(row.attachmentId), nullableText(row.attachmentKey), nullableText(row.attachmentName), nullableText(row.attachmentType),
    row.attachmentSize == null ? null : number(row.attachmentSize), nullableText(row.attachmentUrl),
    number(row.fsrsStability), number(row.fsrsDifficulty), row.orthographyIsCorrect == null ? null : number(row.orthographyIsCorrect),
    text(row.orthographyCorrectForm), text(row.orthographyExplanation), text(row.orthographySource), Math.max(1, number(row.orthographyStage, 1)),
  ] as const;
}

function incomingCardComparable(values: ReturnType<typeof incomingCardValues>) {
  return [
    values.folderId, values.type, values.front, values.back, values.optionsJson, values.correctOption, values.correctOptionsJson,
    values.dueAt, values.createdAt, values.lastReviewedAt, values.intervalDays, values.ease, values.repetitions,
    values.lapses, values.streak, values.reviewCount, values.successCount,
    values.attachmentId, values.attachmentKey, values.attachmentName, values.attachmentType, values.attachmentSize, values.attachmentUrl,
    values.fsrsStability, values.fsrsDifficulty, values.orthographyIsCorrect, values.orthographyCorrectForm,
    values.orthographyExplanation, values.orthographySource, values.orthographyStage,
  ] as const;
}

async function runBatches(
  db: Awaited<ReturnType<typeof getD1>>,
  statements: ReturnType<Awaited<ReturnType<typeof getD1>>["prepare"]>[],
  chunkSize = 75,
) {
  for (let index = 0; index < statements.length; index += chunkSize) {
    await db.batch(statements.slice(index, index + chunkSize));
  }
}

/**
 * Incremental persistence for the normalized D1 schema.
 *
 * The client may continue sending the complete AppState. We compare that state with
 * the currently active normalized rows and only write rows that actually changed.
 * Reviews are append-only, so a normal answer usually means one card UPDATE,
 * one review INSERT and one app_settings UPDATE instead of rewriting the whole DB.
 */
export async function saveStateIncremental(owner: string, state: AppState) {
  const db = await getD1();
  const updatedAt = new Date().toISOString();

  const settings = await db.prepare(
    `SELECT
      active_sync AS activeSync,
      state_version AS stateVersion,
      daily_review_goal AS dailyReviewGoal,
      daily_new_limit AS dailyNewLimit,
      content_seed_version AS seedVersion
     FROM app_settings WHERE owner = ?`,
  ).bind(owner).first<ActiveSettings>();

  // This only happens on a fresh/legacy account. Bootstrap once with the proven
  // snapshot writer, then all later saves use the incremental path.
  if (!settings?.activeSync) {
    const result = await saveStateSnapshot(owner, state);
    return {
      ...result,
      mode: "bootstrap-snapshot" as const,
      writes: null,
    };
  }

  const sync = settings.activeSync;
  const [foldersResult, cardsResult, reviewsResult, psychResult, attemptsResult] = await Promise.all([
    db.prepare(
      `SELECT id, position, name, color, parent_id AS parentId, created_at AS createdAt
       FROM folders WHERE owner = ? AND sync_token = ?`,
    ).bind(owner, sync).all<ExistingFolder>(),
    db.prepare(
      `SELECT
        id, position, folder_id AS folderId, type, front, back, options_json AS optionsJson,
        correct_option AS correctOption, correct_options_json AS correctOptionsJson,
        due_at AS dueAt, created_at AS createdAt, last_reviewed_at AS lastReviewedAt,
        interval_days AS intervalDays, ease, repetitions, lapses, streak,
        review_count AS reviewCount, success_count AS successCount,
        attachment_id AS attachmentId, attachment_key AS attachmentKey, attachment_name AS attachmentName,
        attachment_type AS attachmentType, attachment_size AS attachmentSize, attachment_url AS attachmentUrl,
        fsrs_stability AS fsrsStability, fsrs_difficulty AS fsrsDifficulty,
        orthography_is_correct AS orthographyIsCorrect, orthography_correct_form AS orthographyCorrectForm,
        orthography_explanation AS orthographyExplanation, orthography_source AS orthographySource,
        orthography_stage AS orthographyStage
       FROM cards WHERE owner = ? AND sync_token = ?`,
    ).bind(owner, sync).all<ExistingCard>(),
    db.prepare(
      `SELECT id FROM reviews WHERE owner = ? AND sync_token = ?`,
    ).bind(owner, sync).all<ExistingReview>(),
    db.prepare(
      `SELECT
        id, position, name, category, total_questions AS totalQuestions,
        attachment_id AS attachmentId, attachment_key AS attachmentKey, attachment_name AS attachmentName,
        attachment_type AS attachmentType, attachment_size AS attachmentSize, attachment_url AS attachmentUrl,
        created_at AS createdAt
       FROM psych_tests WHERE owner = ? AND sync_token = ?`,
    ).bind(owner, sync).all<ExistingPsych>(),
    db.prepare(
      `SELECT
        id, psych_test_id AS psychTestId, position, date, correct, wrong, blank, score, minutes, notes
       FROM psych_attempts WHERE owner = ? AND sync_token = ?`,
    ).bind(owner, sync).all<ExistingAttempt>(),
  ]);

  const existingFolders = new Map((foldersResult.results ?? []).map((row) => [row.id, row]));
  const existingCards = new Map((cardsResult.results ?? []).map((row) => [row.id, row]));
  const existingReviews = new Set((reviewsResult.results ?? []).map((row) => row.id));
  const existingPsych = new Map((psychResult.results ?? []).map((row) => [row.id, row]));
  const existingAttempts = new Map((attemptsResult.results ?? []).map((row) => [row.id, row]));

  let nextFolderPosition = Math.max(-1, ...(foldersResult.results ?? []).map((row) => number(row.position, -1))) + 1;
  let nextCardPosition = Math.max(-1, ...(cardsResult.results ?? []).map((row) => number(row.position, -1))) + 1;
  let nextReviewPosition = (reviewsResult.results ?? []).length;
  let nextPsychPosition = Math.max(-1, ...(psychResult.results ?? []).map((row) => number(row.position, -1))) + 1;
  const maxAttemptPositionByTest = new Map<string, number>();
  for (const row of attemptsResult.results ?? []) {
    maxAttemptPositionByTest.set(row.psychTestId, Math.max(maxAttemptPositionByTest.get(row.psychTestId) ?? -1, number(row.position, -1)));
  }

  const statements: ReturnType<typeof db.prepare>[] = [];
  const counts: WriteCounts = { folders: 0, cards: 0, reviews: 0, psychTests: 0, psychAttempts: 0, deletions: 0 };

  const incomingFolderIds = new Set(state.folders.map((folder) => folder.id));
  for (const folder of state.folders) {
    const current = existingFolders.get(folder.id);
    if (!current) {
      statements.push(db.prepare(
        `INSERT INTO folders (owner, id, sync_token, position, name, color, parent_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(owner, folder.id, sync, nextFolderPosition++, folder.name, folder.color, folder.parentId, folder.createdAt));
      counts.folders += 1;
      continue;
    }
    if (!sameValues(
      [current.name, current.color, current.parentId, current.createdAt],
      [folder.name, folder.color, folder.parentId, folder.createdAt],
    )) {
      statements.push(db.prepare(
        `UPDATE folders SET name = ?, color = ?, parent_id = ?, created_at = ?
         WHERE owner = ? AND id = ? AND sync_token = ?`,
      ).bind(folder.name, folder.color, folder.parentId, folder.createdAt, owner, folder.id, sync));
      counts.folders += 1;
    }
  }
  for (const current of existingFolders.values()) {
    if (!incomingFolderIds.has(current.id)) {
      statements.push(db.prepare(`DELETE FROM folders WHERE owner = ? AND id = ? AND sync_token = ?`).bind(owner, current.id, sync));
      counts.deletions += 1;
    }
  }

  const incomingCardIds = new Set(state.cards.map((card) => card.id));
  for (const card of state.cards) {
    const current = existingCards.get(card.id);
    const values = incomingCardValues(card, current);
    if (!current) {
      statements.push(db.prepare(
        `INSERT INTO cards (
          owner, id, sync_token, position, folder_id, type, front, back, options_json, correct_option, correct_options_json,
          due_at, created_at, last_reviewed_at, interval_days, ease, repetitions, lapses, streak, review_count, success_count,
          attachment_id, attachment_key, attachment_name, attachment_type, attachment_size, attachment_url,
          fsrs_stability, fsrs_difficulty, orthography_is_correct, orthography_correct_form,
          orthography_explanation, orthography_source, orthography_stage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        owner, card.id, sync, nextCardPosition++, values.folderId, values.type, values.front, values.back,
        values.optionsJson, values.correctOption, values.correctOptionsJson, values.dueAt, values.createdAt, values.lastReviewedAt,
        values.intervalDays, values.ease, values.repetitions, values.lapses, values.streak, values.reviewCount, values.successCount,
        values.attachmentId, values.attachmentKey, values.attachmentName, values.attachmentType, values.attachmentSize, values.attachmentUrl,
        values.fsrsStability, values.fsrsDifficulty, values.orthographyIsCorrect, values.orthographyCorrectForm,
        values.orthographyExplanation, values.orthographySource, values.orthographyStage,
      ));
      counts.cards += 1;
      continue;
    }
    if (!sameValues(cardComparable(current), incomingCardComparable(values))) {
      statements.push(db.prepare(
        `UPDATE cards SET
          folder_id = ?, type = ?, front = ?, back = ?, options_json = ?, correct_option = ?, correct_options_json = ?,
          due_at = ?, created_at = ?, last_reviewed_at = ?, interval_days = ?, ease = ?, repetitions = ?, lapses = ?,
          streak = ?, review_count = ?, success_count = ?, attachment_id = ?, attachment_key = ?, attachment_name = ?,
          attachment_type = ?, attachment_size = ?, attachment_url = ?, fsrs_stability = ?, fsrs_difficulty = ?,
          orthography_is_correct = ?, orthography_correct_form = ?, orthography_explanation = ?, orthography_source = ?, orthography_stage = ?
         WHERE owner = ? AND id = ? AND sync_token = ?`,
      ).bind(
        values.folderId, values.type, values.front, values.back, values.optionsJson, values.correctOption, values.correctOptionsJson,
        values.dueAt, values.createdAt, values.lastReviewedAt, values.intervalDays, values.ease, values.repetitions, values.lapses,
        values.streak, values.reviewCount, values.successCount, values.attachmentId, values.attachmentKey, values.attachmentName,
        values.attachmentType, values.attachmentSize, values.attachmentUrl, values.fsrsStability, values.fsrsDifficulty,
        values.orthographyIsCorrect, values.orthographyCorrectForm, values.orthographyExplanation, values.orthographySource,
        values.orthographyStage, owner, card.id, sync,
      ));
      counts.cards += 1;
    }
  }
  for (const current of existingCards.values()) {
    if (!incomingCardIds.has(current.id)) {
      statements.push(db.prepare(`DELETE FROM cards WHERE owner = ? AND id = ? AND sync_token = ?`).bind(owner, current.id, sync));
      counts.deletions += 1;
    }
  }

  // Review rows are immutable event records. Never delete them because a slightly older
  // overlapping client save must not be able to erase a review that already reached D1.
  for (const review of state.reviews) {
    if (existingReviews.has(review.id)) continue;
    statements.push(db.prepare(
      `INSERT INTO reviews (
        owner, id, sync_token, position, card_id, rating, correct, reviewed_at,
        response_ms, session_mode, reinforcement, predicted_recall, fsrs_retrievability
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      owner, review.id, sync, nextReviewPosition++, review.cardId, review.rating, review.correct ? 1 : 0, review.reviewedAt,
      Math.max(0, number(review.responseMs)), review.sessionMode ?? "recommended", review.reinforcement ? 1 : 0,
      number(review.predictedRecall, -1), number(review.fsrsRetrievability, -1),
    ));
    counts.reviews += 1;
  }

  const incomingPsychIds = new Set(state.psychTests.map((test) => test.id));
  for (const test of state.psychTests) {
    const current = existingPsych.get(test.id);
    const nextValues = [
      test.name, test.category, number(test.totalQuestions), test.attachment?.id ?? null, test.attachment?.key ?? null,
      test.attachment?.name ?? null, test.attachment?.type ?? null, test.attachment?.size ?? null,
      test.attachment?.url ?? null, test.createdAt,
    ] as const;
    if (!current) {
      statements.push(db.prepare(
        `INSERT INTO psych_tests (
          owner, id, sync_token, position, name, category, total_questions,
          attachment_id, attachment_key, attachment_name, attachment_type, attachment_size, attachment_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(owner, test.id, sync, nextPsychPosition++, ...nextValues));
      counts.psychTests += 1;
    } else {
      const currentValues = [
        current.name, current.category, number(current.totalQuestions), current.attachmentId, current.attachmentKey,
        current.attachmentName, current.attachmentType, current.attachmentSize == null ? null : number(current.attachmentSize),
        current.attachmentUrl, current.createdAt,
      ] as const;
      if (!sameValues(currentValues, nextValues)) {
        statements.push(db.prepare(
          `UPDATE psych_tests SET
            name = ?, category = ?, total_questions = ?, attachment_id = ?, attachment_key = ?, attachment_name = ?,
            attachment_type = ?, attachment_size = ?, attachment_url = ?, created_at = ?
           WHERE owner = ? AND id = ? AND sync_token = ?`,
        ).bind(...nextValues, owner, test.id, sync));
        counts.psychTests += 1;
      }
    }
  }
  for (const current of existingPsych.values()) {
    if (!incomingPsychIds.has(current.id)) {
      statements.push(db.prepare(`DELETE FROM psych_tests WHERE owner = ? AND id = ? AND sync_token = ?`).bind(owner, current.id, sync));
      statements.push(db.prepare(`DELETE FROM psych_attempts WHERE owner = ? AND psych_test_id = ? AND sync_token = ?`).bind(owner, current.id, sync));
      counts.deletions += 2;
    }
  }

  const incomingAttemptIds = new Set<string>();
  for (const test of state.psychTests) {
    let nextAttemptPosition = (maxAttemptPositionByTest.get(test.id) ?? -1) + 1;
    for (const attempt of test.attempts) {
      incomingAttemptIds.add(attempt.id);
      const current = existingAttempts.get(attempt.id);
      const nextValues = [
        test.id, attempt.date, number(attempt.correct), number(attempt.wrong), number(attempt.blank),
        number(attempt.score), number(attempt.minutes), attempt.notes,
      ] as const;
      if (!current) {
        statements.push(db.prepare(
          `INSERT INTO psych_attempts (
            owner, id, sync_token, psych_test_id, position, date, correct, wrong, blank, score, minutes, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(owner, attempt.id, sync, test.id, nextAttemptPosition++, attempt.date, attempt.correct, attempt.wrong,
          attempt.blank, attempt.score, attempt.minutes, attempt.notes));
        counts.psychAttempts += 1;
      } else {
        const currentValues = [
          current.psychTestId, current.date, number(current.correct), number(current.wrong), number(current.blank),
          number(current.score), number(current.minutes), current.notes,
        ] as const;
        if (!sameValues(currentValues, nextValues)) {
          statements.push(db.prepare(
            `UPDATE psych_attempts SET psych_test_id = ?, date = ?, correct = ?, wrong = ?, blank = ?, score = ?, minutes = ?, notes = ?
             WHERE owner = ? AND id = ? AND sync_token = ?`,
          ).bind(...nextValues, owner, attempt.id, sync));
          counts.psychAttempts += 1;
        }
      }
    }
  }
  for (const current of existingAttempts.values()) {
    if (incomingPsychIds.has(current.psychTestId) && !incomingAttemptIds.has(current.id)) {
      statements.push(db.prepare(`DELETE FROM psych_attempts WHERE owner = ? AND id = ? AND sync_token = ?`).bind(owner, current.id, sync));
      counts.deletions += 1;
    }
  }

  if (statements.length) await runBatches(db, statements);

  // One tiny settings row marks the latest successful save. active_sync stays stable.
  await db.prepare(
    `UPDATE app_settings SET
      state_version = ?, daily_review_goal = ?, daily_new_limit = ?, content_seed_version = ?, updated_at = ?
     WHERE owner = ?`,
  ).bind(
    state.version ?? 1,
    state.settings.dailyReviewGoal,
    state.settings.dailyNewLimit,
    number(state.settings.seedVersion),
    updatedAt,
    owner,
  ).run();

  return {
    updatedAt,
    activeSync: sync,
    legacyBackupStored: false,
    mode: "incremental" as const,
    writes: {
      ...counts,
      settings: 1,
      estimatedRows: statements.length + 1,
    },
  };
}
