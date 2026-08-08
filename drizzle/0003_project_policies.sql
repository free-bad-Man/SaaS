CREATE TABLE IF NOT EXISTS project_policies (
  project_id TEXT PRIMARY KEY,
  configuration_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

PRAGMA optimize;
