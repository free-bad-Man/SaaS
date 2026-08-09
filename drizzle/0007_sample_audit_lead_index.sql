CREATE INDEX IF NOT EXISTS idx_sample_audit_leads_created_at
  ON sample_audit_leads(created_at DESC);

PRAGMA optimize;
