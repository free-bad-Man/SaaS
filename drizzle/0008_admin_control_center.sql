ALTER TABLE accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'member';

CREATE INDEX IF NOT EXISTS idx_accounts_status_plan_updated_at
  ON accounts(status, plan, updated_at DESC);

PRAGMA optimize;
