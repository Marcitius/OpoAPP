import { getD1 } from "@/db";

type Rating = "again" | "hard" | "good" | "easy";
type CardType = "basic" | "choice";

type Folder = {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  createdAt: string;
};

type Card = {
  id: string;
  folderId: string;
  type: CardType;
  front: string;
  back: string;
  options: string[];
  correctOption: number;
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
  attachment: Attachment | null;
  fsrsStability: number;
  fsrsDifficulty: number;
};

type Review = {
  id: string;
  cardId: string;
  rating: Rating;
  correct: boolean;
  reviewedAt: string;
  responseMs?: number;
  sessionMode?: string;
  reinforcement?: boolean;
  predictedRecall?: number;
  fsrsRetrievability?: number;
};

type Attachment = {
  id: string;
  key: string;
  name: string;
  type: string;
  size: number;
  url: string;
};

type Attempt = {
  id: string;
  date: string;
  correct: number;
  wrong: number;
  blank: number;
  score: number;
  minutes: number;
  notes: string;
};

type PsychTest = {
  id: string;
  name: string;
  category: string;
  totalQuestions: number;
  attachment: Attachment | null;
  attempts: Attempt[];
  createdAt: string;
};

export type AppState = {
  version: 1;
  folders: Folder[];
  cards: Card[];
  reviews: Review[];
  psychTests: PsychTest[];
  settings: { dailyReviewGoal: number; dailyNewLimit: number; seedVersion?: number };
};

type SettingsRow = {
  stateVersion: number;
  dailyReviewGoal: number;
  dailyNewLimit: number;
  seedVersion: number;
  activeSync: string;
  updatedAt: string;
};

type FolderRow = {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  createdAt: string;
};

type CardRow = {
  id: string;
  folderId: string;
  type: CardType;
  front: string;
  back: string;
  optionsJson: string;
  correctOption: number;
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
};

type ReviewRow = {
  id: string;
  cardId: string;
  rating: Rating;
  correct: number;
  reviewedAt: string;
  responseMs: number;
  sessionMode: string;
  reinforcement: number;
  predictedRecall: number;
  fsrsRetrievability: number;
};

type PsychRow = {
  id: string;
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

type AttemptRow = {
  id: string;
  psychTestId: string;
  date: string;
  correct: number;
  wrong: number;
  blank: number;
  score: number;
  minutes: number;
  notes: string;
};

const LEGACY_BACKUP_LIMIT = 1_500_000;

const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS app_state (
    owner TEXT PRIMARY KEY NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    owner TEXT PRIMARY KEY NOT NULL,
    state_version INTEGER NOT NULL DEFAULT 1,
    daily_review_goal INTEGER NOT NULL DEFAULT 30,
    daily_new_limit INTEGER NOT NULL DEFAULT 12,
    content_seed_version INTEGER NOT NULL DEFAULT 0,
    active_sync TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS folders (
    owner TEXT NOT NULL,
    id TEXT NOT NULL,
    sync_token TEXT NOT NULL,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    parent_id TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (owner, id, sync_token)
  )`,
  `CREATE TABLE IF NOT EXISTS cards (
    owner TEXT NOT NULL,
    id TEXT NOT NULL,
    sync_token TEXT NOT NULL,
    position INTEGER NOT NULL,
    folder_id TEXT NOT NULL,
    type TEXT NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    options_json TEXT NOT NULL,
    correct_option INTEGER NOT NULL,
    due_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_reviewed_at TEXT,
    interval_days REAL NOT NULL DEFAULT 0,
    ease REAL NOT NULL DEFAULT 2.35,
    repetitions INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    attachment_id TEXT,
    attachment_key TEXT,
    attachment_name TEXT,
    attachment_type TEXT,
    attachment_size INTEGER,
    attachment_url TEXT,
    fsrs_stability REAL NOT NULL DEFAULT 0,
    fsrs_difficulty REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (owner, id, sync_token)
  )`,
  `CREATE TABLE IF NOT EXISTS reviews (
    owner TEXT NOT NULL,
    id TEXT NOT NULL,
    sync_token TEXT NOT NULL,
    position INTEGER NOT NULL,
    card_id TEXT NOT NULL,
    rating TEXT NOT NULL,
    correct INTEGER NOT NULL,
    reviewed_at TEXT NOT NULL,
    response_ms INTEGER NOT NULL DEFAULT 0,
    session_mode TEXT NOT NULL DEFAULT 'recommended',
    reinforcement INTEGER NOT NULL DEFAULT 0,
    predicted_recall REAL NOT NULL DEFAULT -1,
    fsrs_retrievability REAL NOT NULL DEFAULT -1,
    PRIMARY KEY (owner, id, sync_token)
  )`,
  `CREATE TABLE IF NOT EXISTS psych_tests (
    owner TEXT NOT NULL,
    id TEXT NOT NULL,
    sync_token TEXT NOT NULL,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    total_questions INTEGER NOT NULL,
    attachment_id TEXT,
    attachment_key TEXT,
    attachment_name TEXT,
    attachment_type TEXT,
    attachment_size INTEGER,
    attachment_url TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (owner, id, sync_token)
  )`,
  `CREATE TABLE IF NOT EXISTS psych_attempts (
    owner TEXT NOT NULL,
    id TEXT NOT NULL,
    sync_token TEXT NOT NULL,
    psych_test_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    date TEXT NOT NULL,
    correct INTEGER NOT NULL,
    wrong INTEGER NOT NULL,
    blank INTEGER NOT NULL,
    score REAL NOT NULL,
    minutes REAL NOT NULL,
    notes TEXT NOT NULL,
    PRIMARY KEY (owner, id, sync_token)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(owner, sync_token, due_at)`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_card ON reviews(owner, sync_token, card_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attempts_test ON psych_attempts(owner, sync_token, psych_test_id)`,
];

const SETTINGS_COLUMN_MIGRATIONS = [
  "ALTER TABLE app_settings ADD COLUMN content_seed_version INTEGER NOT NULL DEFAULT 0",
];

const CARD_COLUMN_MIGRATIONS = [
  "ALTER TABLE cards ADD COLUMN attachment_id TEXT",
  "ALTER TABLE cards ADD COLUMN attachment_key TEXT",
  "ALTER TABLE cards ADD COLUMN attachment_name TEXT",
  "ALTER TABLE cards ADD COLUMN attachment_type TEXT",
  "ALTER TABLE cards ADD COLUMN attachment_size INTEGER",
  "ALTER TABLE cards ADD COLUMN attachment_url TEXT",
  "ALTER TABLE cards ADD COLUMN fsrs_stability REAL NOT NULL DEFAULT 0",
  "ALTER TABLE cards ADD COLUMN fsrs_difficulty REAL NOT NULL DEFAULT 0",
];

const REVIEW_COLUMN_MIGRATIONS = [
  "ALTER TABLE reviews ADD COLUMN response_ms INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE reviews ADD COLUMN session_mode TEXT NOT NULL DEFAULT 'recommended'",
  "ALTER TABLE reviews ADD COLUMN reinforcement INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE reviews ADD COLUMN predicted_recall REAL NOT NULL DEFAULT -1",
  "ALTER TABLE reviews ADD COLUMN fsrs_retrievability REAL NOT NULL DEFAULT -1",
];

export async function ensureNormalizedSchema() {
  const db = await getD1();
  await db.batch(SCHEMA_SQL.map((sql) => db.prepare(sql)));
  // D1/SQLite does not add new columns when CREATE TABLE IF NOT EXISTS runs.
  // Apply additive migrations safely; duplicate-column errors simply mean the migration already ran.
  for (const sql of [...SETTINGS_COLUMN_MIGRATIONS, ...CARD_COLUMN_MIGRATIONS, ...REVIEW_COLUMN_MIGRATIONS]) {
    try {
      await db.prepare(sql).run();
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (!message.includes("duplicate column") && !message.includes("already exists")) throw error;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isAppState(value: unknown): value is AppState {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.folders) || !Array.isArray(value.cards) || !Array.isArray(value.reviews) || !Array.isArray(value.psychTests)) return false;
  if (!isRecord(value.settings)) return false;
  return typeof value.settings.dailyReviewGoal === "number" && typeof value.settings.dailyNewLimit === "number";
}

async function runBatches(db: Awaited<ReturnType<typeof getD1>>, statements: ReturnType<Awaited<ReturnType<typeof getD1>>["prepare"]>[], chunkSize = 75) {
  for (let index = 0; index < statements.length; index += chunkSize) {
    await db.batch(statements.slice(index, index + chunkSize));
  }
}

async function writeSnapshot(owner: string, state: AppState, updatedAt: string) {
  const db = await getD1();
  const syncToken = crypto.randomUUID();

  const folderStatements = state.folders.map((folder, position) =>
    db.prepare(
      `INSERT INTO folders (owner, id, sync_token, position, name, color, parent_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(owner, folder.id, syncToken, position, folder.name, folder.color, folder.parentId, folder.createdAt),
  );

  const cardStatements = state.cards.map((card, position) =>
    db.prepare(
      `INSERT INTO cards (
        owner, id, sync_token, position, folder_id, type, front, back, options_json, correct_option,
        due_at, created_at, last_reviewed_at, interval_days, ease, repetitions, lapses, streak, review_count, success_count,
        attachment_id, attachment_key, attachment_name, attachment_type, attachment_size, attachment_url, fsrs_stability, fsrs_difficulty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      owner,
      card.id,
      syncToken,
      position,
      card.folderId,
      card.type,
      card.front,
      card.back,
      JSON.stringify(card.options ?? []),
      card.correctOption,
      card.dueAt,
      card.createdAt,
      card.lastReviewedAt,
      card.intervalDays,
      card.ease,
      card.repetitions,
      card.lapses,
      card.streak,
      card.reviewCount,
      card.successCount,
      card.attachment?.id ?? null,
      card.attachment?.key ?? null,
      card.attachment?.name ?? null,
      card.attachment?.type ?? null,
      card.attachment?.size ?? null,
      card.attachment?.url ?? null,
      Number(card.fsrsStability ?? 0),
      Number(card.fsrsDifficulty ?? 0),
    ),
  );

  const reviewStatements = state.reviews.map((review, position) =>
    db.prepare(
      `INSERT INTO reviews (
        owner, id, sync_token, position, card_id, rating, correct, reviewed_at,
        response_ms, session_mode, reinforcement, predicted_recall, fsrs_retrievability
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      owner,
      review.id,
      syncToken,
      position,
      review.cardId,
      review.rating,
      review.correct ? 1 : 0,
      review.reviewedAt,
      Math.max(0, Number(review.responseMs ?? 0)),
      review.sessionMode ?? "recommended",
      review.reinforcement ? 1 : 0,
      Number(review.predictedRecall ?? -1),
      Number(review.fsrsRetrievability ?? -1),
    ),
  );

  const psychStatements = state.psychTests.map((test, position) =>
    db.prepare(
      `INSERT INTO psych_tests (
        owner, id, sync_token, position, name, category, total_questions,
        attachment_id, attachment_key, attachment_name, attachment_type, attachment_size, attachment_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      owner,
      test.id,
      syncToken,
      position,
      test.name,
      test.category,
      test.totalQuestions,
      test.attachment?.id ?? null,
      test.attachment?.key ?? null,
      test.attachment?.name ?? null,
      test.attachment?.type ?? null,
      test.attachment?.size ?? null,
      test.attachment?.url ?? null,
      test.createdAt,
    ),
  );

  const attemptStatements = state.psychTests.flatMap((test) =>
    test.attempts.map((attempt, position) =>
      db.prepare(
        `INSERT INTO psych_attempts (
          owner, id, sync_token, psych_test_id, position, date, correct, wrong, blank, score, minutes, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        owner,
        attempt.id,
        syncToken,
        test.id,
        position,
        attempt.date,
        attempt.correct,
        attempt.wrong,
        attempt.blank,
        attempt.score,
        attempt.minutes,
        attempt.notes,
      ),
    ),
  );

  await runBatches(db, folderStatements);
  await runBatches(db, cardStatements);
  await runBatches(db, reviewStatements);
  await runBatches(db, psychStatements);
  await runBatches(db, attemptStatements);

  // The active snapshot is changed only after every row above has been written.
  // If any insertion fails, the previous snapshot remains active and readable.
  await db.prepare(
    `INSERT INTO app_settings (
      owner, state_version, daily_review_goal, daily_new_limit, content_seed_version, active_sync, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner) DO UPDATE SET
      state_version = excluded.state_version,
      daily_review_goal = excluded.daily_review_goal,
      daily_new_limit = excluded.daily_new_limit,
      content_seed_version = excluded.content_seed_version,
      active_sync = excluded.active_sync,
      updated_at = excluded.updated_at`,
  ).bind(
    owner,
    state.version ?? 1,
    state.settings.dailyReviewGoal,
    state.settings.dailyNewLimit,
    Number(state.settings.seedVersion ?? 0),
    syncToken,
    updatedAt,
  ).run();

  // Cleanup happens after the switch. A cleanup failure cannot corrupt the active snapshot.
  const cleanup = ["folders", "cards", "reviews", "psych_tests", "psych_attempts"].map((table) =>
    db.prepare(`DELETE FROM ${table} WHERE owner = ? AND sync_token <> ?`).bind(owner, syncToken),
  );
  try {
    await db.batch(cleanup);
  } catch {
    // Old snapshots can be cleaned on a later save; the active snapshot is already safe.
  }

  return syncToken;
}

async function writeLegacyBackup(owner: string, state: AppState, updatedAt: string) {
  const data = JSON.stringify(state);
  if (data.length > LEGACY_BACKUP_LIMIT) return false;

  try {
    const db = await getD1();
    await db.prepare(
      `INSERT INTO app_state (owner, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(owner) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    ).bind(owner, data, updatedAt).run();
    return true;
  } catch {
    // app_state is only a compatibility backup after normalization.
    return false;
  }
}

export async function saveState(owner: string, state: AppState) {
  await ensureNormalizedSchema();
  const updatedAt = new Date().toISOString();

  const activeSync = await writeSnapshot(owner, state, updatedAt);
  const legacyBackupStored = await writeLegacyBackup(owner, state, updatedAt);

  return { updatedAt, activeSync, legacyBackupStored };
}

export async function loadState(owner: string): Promise<{ state: AppState | null; updatedAt: string | null; migrated: boolean }> {
  await ensureNormalizedSchema();
  const db = await getD1();

  let settings = await db.prepare(
    `SELECT
      state_version AS stateVersion,
      daily_review_goal AS dailyReviewGoal,
      daily_new_limit AS dailyNewLimit,
      content_seed_version AS seedVersion,
      active_sync AS activeSync,
      updated_at AS updatedAt
     FROM app_settings WHERE owner = ?`,
  ).bind(owner).first<SettingsRow>();

  let migrated = false;

  if (!settings) {
    const legacy = await db.prepare("SELECT data, updated_at AS updatedAt FROM app_state WHERE owner = ?")
      .bind(owner)
      .first<{ data: string; updatedAt: string }>();

    if (!legacy) return { state: null, updatedAt: null, migrated: false };

    let parsed: unknown;
    try {
      parsed = JSON.parse(legacy.data);
    } catch {
      throw new Error("El progreso anterior existe, pero no se puede interpretar");
    }

    if (!isAppState(parsed)) throw new Error("El progreso anterior no tiene un formato válido");

    await writeSnapshot(owner, parsed, legacy.updatedAt || new Date().toISOString());
    migrated = true;

    settings = await db.prepare(
      `SELECT
        state_version AS stateVersion,
        daily_review_goal AS dailyReviewGoal,
        daily_new_limit AS dailyNewLimit,
        content_seed_version AS seedVersion,
        active_sync AS activeSync,
        updated_at AS updatedAt
       FROM app_settings WHERE owner = ?`,
    ).bind(owner).first<SettingsRow>();
  }

  if (!settings) return { state: null, updatedAt: null, migrated };

  const sync = settings.activeSync;
  const [foldersResult, cardsResult, reviewsResult, psychResult, attemptsResult] = await Promise.all([
    db.prepare(
      `SELECT id, name, color, parent_id AS parentId, created_at AS createdAt
       FROM folders WHERE owner = ? AND sync_token = ? ORDER BY position`,
    ).bind(owner, sync).all<FolderRow>(),
    db.prepare(
      `SELECT
        id, folder_id AS folderId, type, front, back, options_json AS optionsJson,
        correct_option AS correctOption, due_at AS dueAt, created_at AS createdAt,
        last_reviewed_at AS lastReviewedAt, interval_days AS intervalDays, ease,
        repetitions, lapses, streak, review_count AS reviewCount, success_count AS successCount,
        attachment_id AS attachmentId, attachment_key AS attachmentKey, attachment_name AS attachmentName,
        attachment_type AS attachmentType, attachment_size AS attachmentSize, attachment_url AS attachmentUrl,
        fsrs_stability AS fsrsStability, fsrs_difficulty AS fsrsDifficulty
       FROM cards WHERE owner = ? AND sync_token = ? ORDER BY position`,
    ).bind(owner, sync).all<CardRow>(),
    db.prepare(
      `SELECT
        id, card_id AS cardId, rating, correct, reviewed_at AS reviewedAt,
        response_ms AS responseMs, session_mode AS sessionMode, reinforcement,
        predicted_recall AS predictedRecall, fsrs_retrievability AS fsrsRetrievability
       FROM reviews WHERE owner = ? AND sync_token = ? ORDER BY position`,
    ).bind(owner, sync).all<ReviewRow>(),
    db.prepare(
      `SELECT
        id, name, category, total_questions AS totalQuestions,
        attachment_id AS attachmentId, attachment_key AS attachmentKey,
        attachment_name AS attachmentName, attachment_type AS attachmentType,
        attachment_size AS attachmentSize, attachment_url AS attachmentUrl,
        created_at AS createdAt
       FROM psych_tests WHERE owner = ? AND sync_token = ? ORDER BY position`,
    ).bind(owner, sync).all<PsychRow>(),
    db.prepare(
      `SELECT
        id, psych_test_id AS psychTestId, date, correct, wrong, blank, score, minutes, notes
       FROM psych_attempts WHERE owner = ? AND sync_token = ?
       ORDER BY psych_test_id, position`,
    ).bind(owner, sync).all<AttemptRow>(),
  ]);

  const attemptsByTest = new Map<string, Attempt[]>();
  for (const row of attemptsResult.results ?? []) {
    const list = attemptsByTest.get(row.psychTestId) ?? [];
    list.push({
      id: row.id,
      date: row.date,
      correct: Number(row.correct),
      wrong: Number(row.wrong),
      blank: Number(row.blank),
      score: Number(row.score),
      minutes: Number(row.minutes),
      notes: row.notes ?? "",
    });
    attemptsByTest.set(row.psychTestId, list);
  }

  const state: AppState = {
    version: 1,
    settings: {
      dailyReviewGoal: Number(settings.dailyReviewGoal),
      dailyNewLimit: Number(settings.dailyNewLimit),
      seedVersion: Number(settings.seedVersion ?? 0),
    },
    folders: (foldersResult.results ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      parentId: row.parentId,
      createdAt: row.createdAt,
    })),
    cards: (cardsResult.results ?? []).map((row) => {
      let options: string[] = [];
      try {
        const parsed = JSON.parse(row.optionsJson);
        if (Array.isArray(parsed)) options = parsed.map((value) => String(value));
      } catch {
        options = [];
      }
      return {
        id: row.id,
        folderId: row.folderId,
        type: row.type,
        front: row.front,
        back: row.back,
        options,
        correctOption: Number(row.correctOption),
        dueAt: row.dueAt,
        createdAt: row.createdAt,
        lastReviewedAt: row.lastReviewedAt,
        intervalDays: Number(row.intervalDays),
        ease: Number(row.ease),
        repetitions: Number(row.repetitions),
        lapses: Number(row.lapses),
        streak: Number(row.streak),
        reviewCount: Number(row.reviewCount),
        successCount: Number(row.successCount),
        attachment: row.attachmentKey
          ? {
              id: row.attachmentId ?? row.id,
              key: row.attachmentKey,
              name: row.attachmentName ?? "imagen",
              type: row.attachmentType ?? "image/jpeg",
              size: Number(row.attachmentSize ?? 0),
              url: row.attachmentUrl ?? `/api/files?key=${encodeURIComponent(row.attachmentKey)}`,
            }
          : null,
        fsrsStability: Number(row.fsrsStability ?? 0),
        fsrsDifficulty: Number(row.fsrsDifficulty ?? 0),
      };
    }),
    reviews: (reviewsResult.results ?? []).map((row) => ({
      id: row.id,
      cardId: row.cardId,
      rating: row.rating,
      correct: Boolean(row.correct),
      reviewedAt: row.reviewedAt,
      responseMs: Number(row.responseMs ?? 0),
      sessionMode: row.sessionMode ?? "recommended",
      reinforcement: Boolean(row.reinforcement),
      predictedRecall: Number(row.predictedRecall ?? -1),
      fsrsRetrievability: Number(row.fsrsRetrievability ?? -1),
    })),
    psychTests: (psychResult.results ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      totalQuestions: Number(row.totalQuestions),
      attachment: row.attachmentKey
        ? {
            id: row.attachmentId ?? row.id,
            key: row.attachmentKey,
            name: row.attachmentName ?? "documento",
            type: row.attachmentType ?? "application/pdf",
            size: Number(row.attachmentSize ?? 0),
            url: row.attachmentUrl ?? `/api/files?key=${encodeURIComponent(row.attachmentKey)}`,
          }
        : null,
      attempts: attemptsByTest.get(row.id) ?? [],
      createdAt: row.createdAt,
    })),
  };

  return { state, updatedAt: settings.updatedAt, migrated };
}

export async function getStorageStatus(owner: string) {
  await ensureNormalizedSchema();
  const db = await getD1();
  const settings = await db.prepare(
    `SELECT active_sync AS activeSync, updated_at AS updatedAt
     FROM app_settings WHERE owner = ?`,
  ).bind(owner).first<{ activeSync: string; updatedAt: string }>();

  const legacy = await db.prepare("SELECT updated_at AS updatedAt FROM app_state WHERE owner = ?")
    .bind(owner)
    .first<{ updatedAt: string }>();

  if (!settings) {
    return {
      storage: "legacy",
      migrated: false,
      legacyBackup: Boolean(legacy),
      counts: { folders: 0, cards: 0, reviews: 0, psychTests: 0, psychAttempts: 0 },
    };
  }

  const sync = settings.activeSync;
  const count = async (table: string) => {
    const row = await db.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE owner = ? AND sync_token = ?`)
      .bind(owner, sync)
      .first<{ total: number }>();
    return Number(row?.total ?? 0);
  };

  const [folders, cards, reviews, psychTests, psychAttempts] = await Promise.all([
    count("folders"),
    count("cards"),
    count("reviews"),
    count("psych_tests"),
    count("psych_attempts"),
  ]);

  return {
    storage: "normalized",
    migrated: true,
    activeSync: sync,
    updatedAt: settings.updatedAt,
    legacyBackup: Boolean(legacy),
    counts: { folders, cards, reviews, psychTests, psychAttempts },
  };
}
