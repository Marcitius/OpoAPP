import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const appState = sqliteTable("app_state", {
  owner: text("owner").primaryKey(),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const appSettings = sqliteTable("app_settings", {
  owner: text("owner").primaryKey(),
  stateVersion: integer("state_version").notNull().default(1),
  dailyReviewGoal: integer("daily_review_goal").notNull().default(30),
  dailyNewLimit: integer("daily_new_limit").notNull().default(12),
  activeSync: text("active_sync").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const folders = sqliteTable("folders", {
  owner: text("owner").notNull(),
  id: text("id").notNull(),
  syncToken: text("sync_token").notNull(),
  position: integer("position").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  parentId: text("parent_id"),
  createdAt: text("created_at").notNull(),
}, (table) => [primaryKey({ columns: [table.owner, table.id, table.syncToken] })]);

export const cards = sqliteTable("cards", {
  owner: text("owner").notNull(),
  id: text("id").notNull(),
  syncToken: text("sync_token").notNull(),
  position: integer("position").notNull(),
  folderId: text("folder_id").notNull(),
  type: text("type").notNull(),
  front: text("front").notNull(),
  back: text("back").notNull(),
  optionsJson: text("options_json").notNull(),
  correctOption: integer("correct_option").notNull(),
  dueAt: text("due_at").notNull(),
  createdAt: text("created_at").notNull(),
  lastReviewedAt: text("last_reviewed_at"),
  intervalDays: real("interval_days").notNull().default(0),
  ease: real("ease").notNull().default(2.35),
  repetitions: integer("repetitions").notNull().default(0),
  lapses: integer("lapses").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
}, (table) => [primaryKey({ columns: [table.owner, table.id, table.syncToken] })]);

export const reviews = sqliteTable("reviews", {
  owner: text("owner").notNull(),
  id: text("id").notNull(),
  syncToken: text("sync_token").notNull(),
  position: integer("position").notNull(),
  cardId: text("card_id").notNull(),
  rating: text("rating").notNull(),
  correct: integer("correct", { mode: "boolean" }).notNull(),
  reviewedAt: text("reviewed_at").notNull(),
}, (table) => [primaryKey({ columns: [table.owner, table.id, table.syncToken] })]);

export const psychTests = sqliteTable("psych_tests", {
  owner: text("owner").notNull(),
  id: text("id").notNull(),
  syncToken: text("sync_token").notNull(),
  position: integer("position").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  attachmentId: text("attachment_id"),
  attachmentKey: text("attachment_key"),
  attachmentName: text("attachment_name"),
  attachmentType: text("attachment_type"),
  attachmentSize: integer("attachment_size"),
  attachmentUrl: text("attachment_url"),
  createdAt: text("created_at").notNull(),
}, (table) => [primaryKey({ columns: [table.owner, table.id, table.syncToken] })]);

export const psychAttempts = sqliteTable("psych_attempts", {
  owner: text("owner").notNull(),
  id: text("id").notNull(),
  syncToken: text("sync_token").notNull(),
  psychTestId: text("psych_test_id").notNull(),
  position: integer("position").notNull(),
  date: text("date").notNull(),
  correct: integer("correct").notNull(),
  wrong: integer("wrong").notNull(),
  blank: integer("blank").notNull(),
  score: real("score").notNull(),
  minutes: real("minutes").notNull(),
  notes: text("notes").notNull(),
}, (table) => [primaryKey({ columns: [table.owner, table.id, table.syncToken] })]);
