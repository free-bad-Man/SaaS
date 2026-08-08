CREATE TABLE IF NOT EXISTS sample_audit_leads (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  allow_count INTEGER NOT NULL,
  watch_count INTEGER NOT NULL,
  block_count INTEGER NOT NULL,
  average_score INTEGER NOT NULL,
  top_findings_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

PRAGMA optimize;
