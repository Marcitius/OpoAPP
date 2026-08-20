-- Reference migration for OpoGC v4. Runtime migration also runs from db/storage.ts.
ALTER TABLE app_settings ADD COLUMN content_seed_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cards ADD COLUMN attachment_id TEXT;
ALTER TABLE cards ADD COLUMN attachment_key TEXT;
ALTER TABLE cards ADD COLUMN attachment_name TEXT;
ALTER TABLE cards ADD COLUMN attachment_type TEXT;
ALTER TABLE cards ADD COLUMN attachment_size INTEGER;
ALTER TABLE cards ADD COLUMN attachment_url TEXT;
ALTER TABLE cards ADD COLUMN fsrs_stability REAL NOT NULL DEFAULT 0;
ALTER TABLE cards ADD COLUMN fsrs_difficulty REAL NOT NULL DEFAULT 0;
