-- Server-side sessions, so logging out or resetting a password really ends a login (bugs #1, #2).
-- The cookie carries a signed session id; a session is valid only while its row exists and hasn't expired.
CREATE TABLE sessions (
  session_id    TEXT PRIMARY KEY CHECK (length(session_id) BETWEEN 20 AND 64),
  user_id       INTEGER NOT NULL REFERENCES users(user_id),
  created_date  TEXT NOT NULL,
  expires_date  TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- When the last password-reset email was sent, to limit reset emails per address (bug #3).
ALTER TABLE users ADD COLUMN reset_requested_date TEXT;
