CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  connector TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'complete',
  event_count INTEGER NOT NULL,
  postback_count INTEGER NOT NULL,
  accepted_events INTEGER NOT NULL,
  attributed_conversions INTEGER NOT NULL,
  shadow_actions INTEGER NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_project_created_at
  ON pipeline_runs(project_id, created_at DESC);

PRAGMA optimize;
