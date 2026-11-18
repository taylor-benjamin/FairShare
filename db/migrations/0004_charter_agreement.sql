-- Charter agreement: every member agrees to the team goals and expectations, then they lock.
-- Who last changed the goals or expectations, and when (shown as "Last updated by ... on ...").
ALTER TABLE team_charters ADD COLUMN updated_by_id INTEGER REFERENCES users(user_id);
ALTER TABLE team_charters ADD COLUMN updated_date TEXT;
-- Set when every member has agreed. While set, goals and expectations can't be edited until someone reopens them.
ALTER TABLE team_charters ADD COLUMN locked_date TEXT;
-- 1 once this member agrees to the current goals and expectations. Any edit resets it for everyone.
ALTER TABLE team_memberships ADD COLUMN charter_agreed INTEGER NOT NULL DEFAULT 0 CHECK (charter_agreed IN (0, 1));

-- Existing charters: start the "last updated" line at the creation date.
UPDATE team_charters SET updated_date = created_date WHERE updated_date IS NULL;
-- Charters that were already complete count as agreed and locked, so no team loses its finished charter.
UPDATE team_memberships SET charter_agreed = 1
  WHERE team_id IN (SELECT team_id FROM team_charters WHERE completed_date IS NOT NULL);
UPDATE team_charters SET locked_date = completed_date WHERE completed_date IS NOT NULL;
