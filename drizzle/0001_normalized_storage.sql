CREATE TABLE IF NOT EXISTS `app_settings` (
  `owner` text PRIMARY KEY NOT NULL,
  `state_version` integer DEFAULT 1 NOT NULL,
  `daily_review_goal` integer DEFAULT 30 NOT NULL,
  `daily_new_limit` integer DEFAULT 12 NOT NULL,
  `active_sync` text NOT NULL,
  `updated_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `folders` (
  `owner` text NOT NULL,
  `id` text NOT NULL,
  `sync_token` text NOT NULL,
  `position` integer NOT NULL,
  `name` text NOT NULL,
  `color` text NOT NULL,
  `parent_id` text,
  `created_at` text NOT NULL,
  PRIMARY KEY (`owner`, `id`, `sync_token`)
);

CREATE TABLE IF NOT EXISTS `cards` (
  `owner` text NOT NULL,
  `id` text NOT NULL,
  `sync_token` text NOT NULL,
  `position` integer NOT NULL,
  `folder_id` text NOT NULL,
  `type` text NOT NULL,
  `front` text NOT NULL,
  `back` text NOT NULL,
  `options_json` text NOT NULL,
  `correct_option` integer NOT NULL,
  `due_at` text NOT NULL,
  `created_at` text NOT NULL,
  `last_reviewed_at` text,
  `interval_days` real DEFAULT 0 NOT NULL,
  `ease` real DEFAULT 2.35 NOT NULL,
  `repetitions` integer DEFAULT 0 NOT NULL,
  `lapses` integer DEFAULT 0 NOT NULL,
  `streak` integer DEFAULT 0 NOT NULL,
  `review_count` integer DEFAULT 0 NOT NULL,
  `success_count` integer DEFAULT 0 NOT NULL,
  PRIMARY KEY (`owner`, `id`, `sync_token`)
);

CREATE TABLE IF NOT EXISTS `reviews` (
  `owner` text NOT NULL,
  `id` text NOT NULL,
  `sync_token` text NOT NULL,
  `position` integer NOT NULL,
  `card_id` text NOT NULL,
  `rating` text NOT NULL,
  `correct` integer NOT NULL,
  `reviewed_at` text NOT NULL,
  PRIMARY KEY (`owner`, `id`, `sync_token`)
);

CREATE TABLE IF NOT EXISTS `psych_tests` (
  `owner` text NOT NULL,
  `id` text NOT NULL,
  `sync_token` text NOT NULL,
  `position` integer NOT NULL,
  `name` text NOT NULL,
  `category` text NOT NULL,
  `total_questions` integer NOT NULL,
  `attachment_id` text,
  `attachment_key` text,
  `attachment_name` text,
  `attachment_type` text,
  `attachment_size` integer,
  `attachment_url` text,
  `created_at` text NOT NULL,
  PRIMARY KEY (`owner`, `id`, `sync_token`)
);

CREATE TABLE IF NOT EXISTS `psych_attempts` (
  `owner` text NOT NULL,
  `id` text NOT NULL,
  `sync_token` text NOT NULL,
  `psych_test_id` text NOT NULL,
  `position` integer NOT NULL,
  `date` text NOT NULL,
  `correct` integer NOT NULL,
  `wrong` integer NOT NULL,
  `blank` integer NOT NULL,
  `score` real NOT NULL,
  `minutes` real NOT NULL,
  `notes` text NOT NULL,
  PRIMARY KEY (`owner`, `id`, `sync_token`)
);

CREATE INDEX IF NOT EXISTS `idx_cards_due` ON `cards` (`owner`, `sync_token`, `due_at`);
CREATE INDEX IF NOT EXISTS `idx_reviews_card` ON `reviews` (`owner`, `sync_token`, `card_id`);
CREATE INDEX IF NOT EXISTS `idx_attempts_test` ON `psych_attempts` (`owner`, `sync_token`, `psych_test_id`);
