-- OpoGC v9: orthography stored as individual learning units.
-- Runtime migration in db/storage.ts applies the same additive columns safely.
ALTER TABLE cards ADD COLUMN orthography_is_correct INTEGER;
ALTER TABLE cards ADD COLUMN orthography_correct_form TEXT;
ALTER TABLE cards ADD COLUMN orthography_explanation TEXT;
ALTER TABLE cards ADD COLUMN orthography_source TEXT;
ALTER TABLE cards ADD COLUMN orthography_stage INTEGER NOT NULL DEFAULT 1;
