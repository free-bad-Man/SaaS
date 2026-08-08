ALTER TABLE projects ADD COLUMN owner_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_owner_updated_at
  ON projects(owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS accounts (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  trial_ends_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_periods (
  user_id TEXT NOT NULL,
  period TEXT NOT NULL,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  upload_bytes INTEGER NOT NULL DEFAULT 0,
  run_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, period)
);

PRAGMA optimize;
