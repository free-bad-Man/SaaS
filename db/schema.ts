export const PROJECTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export const PIPELINE_RUNS_TABLE_SQL = `
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
  )
`;

export const PIPELINE_RUNS_PROJECT_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_pipeline_runs_project_created_at
  ON pipeline_runs(project_id, created_at DESC)
`;

export const UPLOAD_JOBS_TABLE_SQL = `
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
  )
`;

export const UPLOAD_JOBS_PROJECT_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_upload_jobs_project_created_at
  ON upload_jobs(project_id, created_at DESC)
`;

export const PROJECT_POLICIES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS project_policies (
    project_id TEXT PRIMARY KEY,
    configuration_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )
`;

export const HISTORY_SCHEMA_STATEMENTS = [
  PROJECTS_TABLE_SQL,
  PIPELINE_RUNS_TABLE_SQL,
  PIPELINE_RUNS_PROJECT_INDEX_SQL,
  UPLOAD_JOBS_TABLE_SQL,
  UPLOAD_JOBS_PROJECT_INDEX_SQL,
  PROJECT_POLICIES_TABLE_SQL,
] as const;
