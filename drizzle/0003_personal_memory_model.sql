-- OpoGC v5: richer review telemetry for the personalized memory model.
ALTER TABLE reviews ADD COLUMN response_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reviews ADD COLUMN session_mode TEXT NOT NULL DEFAULT 'recommended';
ALTER TABLE reviews ADD COLUMN reinforcement INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reviews ADD COLUMN predicted_recall REAL NOT NULL DEFAULT -1;
ALTER TABLE reviews ADD COLUMN fsrs_retrievability REAL NOT NULL DEFAULT -1;
