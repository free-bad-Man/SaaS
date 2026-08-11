CREATE TABLE IF NOT EXISTS customer_credentials (
  account_user_id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  session_version INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_credentials_email_normalized
  ON customer_credentials(email_normalized);

PRAGMA optimize;
