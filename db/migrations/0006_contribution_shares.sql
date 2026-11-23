-- Milestone ratings become a percentage split of the work across the whole team, including yourself.
-- Stored in basis points (2500 = 25.00%) so totals are exact. Past 1 to 5 ratings stay in `evaluations`.
CREATE TABLE contribution_shares (
  share_id         INTEGER PRIMARY KEY,
  milestone_id     INTEGER NOT NULL REFERENCES milestones(milestone_id),
  team_id          INTEGER NOT NULL REFERENCES teams(team_id),
  evaluator_id     INTEGER NOT NULL REFERENCES users(user_id),
  evaluatee_id     INTEGER NOT NULL REFERENCES users(user_id),
  share_bp         INTEGER NOT NULL CHECK (share_bp BETWEEN 0 AND 10000),
  comment          TEXT CHECK (comment IS NULL OR length(comment) <= 1000),
  submission_date  TEXT NOT NULL,
  UNIQUE (milestone_id, evaluator_id, evaluatee_id)
);
CREATE INDEX idx_contribution_shares_team ON contribution_shares(team_id, milestone_id);
CREATE INDEX idx_contribution_shares_evaluatee ON contribution_shares(team_id, evaluatee_id);
