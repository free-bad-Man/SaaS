CREATE TABLE IF NOT EXISTS upload_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  file_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  connector TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  total_rows INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  error_json TEXT NOT NULL DEFAULT '[]',
  run_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (run_id) REFERENCES pipeline_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_upload_jobs_project_created_at
  ON upload_jobs(project_id, created_at DESC);

PRAGMA optimize;
