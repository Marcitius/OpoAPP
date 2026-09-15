-- OpoGC v8: tests with one or multiple correct answers.
-- Runtime migration in db/storage.ts applies the same additive change safely.
ALTER TABLE cards ADD COLUMN correct_options_json TEXT NOT NULL DEFAULT '[]';
