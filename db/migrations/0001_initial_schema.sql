-- FairShare initial schema (Milestone 2 relational schema + data dictionary).
-- Types: INTEGER PRIMARY KEY ids, TEXT strings and ISO-8601 dates, INTEGER 0/1 booleans, REAL decimals.
-- CHECK constraints enforce the VARCHAR lengths and allowed values from the data dictionary.

-- D1 enforces foreign keys by default.

CREATE TABLE users (
  user_id        INTEGER PRIMARY KEY,
  first_name     TEXT NOT NULL CHECK (length(first_name) BETWEEN 1 AND 50),
  last_name      TEXT NOT NULL CHECK (length(last_name) BETWEEN 1 AND 50),
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(email) BETWEEN 3 AND 100),
  password_hash  TEXT NOT NULL CHECK (length(password_hash) <= 255),
  system_role    TEXT NOT NULL CHECK (system_role IN ('instructor', 'student', 'viewer')),
  created_date   TEXT NOT NULL
);

CREATE TABLE courses (
  course_id       INTEGER PRIMARY KEY,
  instructor_id   INTEGER NOT NULL REFERENCES users(user_id),
  course_code     TEXT NOT NULL CHECK (length(course_code) BETWEEN 1 AND 20),
  course_name     TEXT NOT NULL CHECK (length(course_name) BETWEEN 1 AND 100),
  section_number  TEXT NOT NULL CHECK (length(section_number) BETWEEN 1 AND 10)
);
CREATE INDEX idx_courses_instructor ON courses(instructor_id);

CREATE TABLE project_templates (
  template_id              INTEGER PRIMARY KEY,
  template_name            TEXT NOT NULL CHECK (length(template_name) BETWEEN 1 AND 50),
  template_description     TEXT NOT NULL,
  settings_explanation     TEXT,
  default_member_access    TEXT NOT NULL CHECK (default_member_access IN ('read', 'write')),
  default_anonymous_evals  INTEGER NOT NULL CHECK (default_anonymous_evals IN (0, 1))
);

CREATE TABLE projects (
  project_id       INTEGER PRIMARY KEY,
  course_id        INTEGER NOT NULL REFERENCES courses(course_id),
  template_id      INTEGER NOT NULL REFERENCES project_templates(template_id),
  project_name     TEXT NOT NULL CHECK (length(project_name) BETWEEN 1 AND 100),
  start_date       TEXT NOT NULL,
  end_date         TEXT NOT NULL,
  anonymous_evals  INTEGER CHECK (anonymous_evals IS NULL OR anonymous_evals IN (0, 1)),
  CHECK (end_date >= start_date)
);
CREATE INDEX idx_projects_course ON projects(course_id);

CREATE TABLE milestones (
  milestone_id      INTEGER PRIMARY KEY,
  project_id        INTEGER NOT NULL REFERENCES projects(project_id),
  milestone_name    TEXT NOT NULL CHECK (length(milestone_name) BETWEEN 1 AND 100),
  due_date          TEXT NOT NULL,
  milestone_status  TEXT NOT NULL DEFAULT 'open' CHECK (milestone_status IN ('open', 'completed')),
  completion_date   TEXT,
  CHECK ((milestone_status = 'completed') = (completion_date IS NOT NULL))
);
CREATE INDEX idx_milestones_project ON milestones(project_id);

CREATE TABLE teams (
  team_id         INTEGER PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES projects(project_id),
  team_name       TEXT NOT NULL CHECK (length(team_name) BETWEEN 1 AND 50),
  channel_status  TEXT NOT NULL DEFAULT 'draft' CHECK (channel_status IN ('draft', 'published', 'finished')),
  visibility      TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  creation_date   TEXT NOT NULL,
  UNIQUE (project_id, team_name),
  -- Only finished channels can be public (P17).
  CHECK (visibility = 'private' OR channel_status = 'finished')
);
CREATE INDEX idx_teams_project ON teams(project_id);
CREATE INDEX idx_teams_visibility ON teams(visibility);

CREATE TABLE team_memberships (
  membership_id   INTEGER PRIMARY KEY,
  team_id         INTEGER NOT NULL REFERENCES teams(team_id),
  user_id         INTEGER NOT NULL REFERENCES users(user_id),
  access_level    TEXT NOT NULL CHECK (access_level IN ('read', 'write')),
  team_role       TEXT CHECK (team_role IS NULL OR length(team_role) <= 50),
  role_confirmed  INTEGER NOT NULL DEFAULT 0 CHECK (role_confirmed IN (0, 1)),
  joined_date     TEXT NOT NULL,
  UNIQUE (team_id, user_id)
);
CREATE INDEX idx_memberships_user ON team_memberships(user_id);

CREATE TABLE invitations (
  invitation_id  INTEGER PRIMARY KEY,
  team_id        INTEGER NOT NULL REFERENCES teams(team_id),
  invited_email  TEXT NOT NULL CHECK (length(invited_email) BETWEEN 3 AND 100),
  invite_token   TEXT NOT NULL UNIQUE CHECK (length(invite_token) <= 64),
  invite_status  TEXT NOT NULL DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted', 'expired')),
  date_received  TEXT NOT NULL,
  accepted_date  TEXT
);
CREATE INDEX idx_invitations_team ON invitations(team_id);

CREATE TABLE team_charters (
  charter_id      INTEGER PRIMARY KEY,
  team_id         INTEGER NOT NULL UNIQUE REFERENCES teams(team_id),
  team_goals      TEXT NOT NULL,
  expectations    TEXT NOT NULL,
  created_date    TEXT NOT NULL,
  completed_date  TEXT
);

CREATE TABLE tasks (
  task_id      INTEGER PRIMARY KEY,
  team_id      INTEGER NOT NULL REFERENCES teams(team_id),
  user_id      INTEGER REFERENCES users(user_id),
  task_title   TEXT NOT NULL CHECK (length(task_title) BETWEEN 1 AND 100),
  due_date     TEXT,
  task_status  TEXT NOT NULL DEFAULT 'to_do' CHECK (task_status IN ('to_do', 'in_progress', 'done'))
);
CREATE INDEX idx_tasks_team ON tasks(team_id);

CREATE TABLE task_reassignments (
  reassignment_id      INTEGER PRIMARY KEY,
  task_id              INTEGER NOT NULL REFERENCES tasks(task_id),
  from_user_id         INTEGER NOT NULL REFERENCES users(user_id),
  to_user_id           INTEGER NOT NULL REFERENCES users(user_id),
  reassigned_by_id     INTEGER NOT NULL REFERENCES users(user_id),
  reassignment_reason  TEXT NOT NULL CHECK (length(reassignment_reason) BETWEEN 1 AND 255),
  reassigned_date      TEXT NOT NULL,
  CHECK (from_user_id <> to_user_id)
);
CREATE INDEX idx_reassignments_task ON task_reassignments(task_id);

CREATE TABLE contributions (
  contribution_id      INTEGER PRIMARY KEY,
  team_id              INTEGER NOT NULL REFERENCES teams(team_id),
  user_id              INTEGER NOT NULL REFERENCES users(user_id),
  task_id              INTEGER REFERENCES tasks(task_id),
  description          TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 255),
  hours_spent          REAL CHECK (hours_spent IS NULL OR (hours_spent >= 0 AND hours_spent <= 999.9)),
  completion_date      TEXT NOT NULL,
  verification_status  TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'confirmed', 'disputed')),
  logged_date          TEXT NOT NULL
);
CREATE INDEX idx_contributions_team ON contributions(team_id, logged_date);
CREATE INDEX idx_contributions_user ON contributions(user_id);

CREATE TABLE verifications (
  verification_id  INTEGER PRIMARY KEY,
  contribution_id  INTEGER NOT NULL REFERENCES contributions(contribution_id),
  verifier_id      INTEGER NOT NULL REFERENCES users(user_id),
  decision         TEXT NOT NULL CHECK (decision IN ('confirm', 'dispute')),
  reason           TEXT CHECK (reason IS NULL OR length(reason) <= 255),
  decision_date    TEXT NOT NULL,
  UNIQUE (contribution_id, verifier_id),
  CHECK (decision = 'confirm' OR (reason IS NOT NULL AND length(trim(reason)) > 0))
);

-- A verifier can never verify their own contribution.
CREATE TRIGGER trg_verifications_not_author
BEFORE INSERT ON verifications
FOR EACH ROW
WHEN NEW.verifier_id = (SELECT user_id FROM contributions WHERE contribution_id = NEW.contribution_id)
BEGIN
  SELECT RAISE(ABORT, 'verifier cannot be the contribution author');
END;

CREATE TABLE disputes (
  dispute_id       INTEGER PRIMARY KEY,
  verification_id  INTEGER NOT NULL UNIQUE REFERENCES verifications(verification_id),
  resolved_by_id   INTEGER REFERENCES users(user_id),
  dispute_status   TEXT NOT NULL DEFAULT 'open' CHECK (dispute_status IN ('open', 'upheld', 'rejected')),
  resolution_note  TEXT CHECK (resolution_note IS NULL OR length(resolution_note) <= 255),
  opened_date      TEXT NOT NULL,
  resolved_date    TEXT
);
CREATE INDEX idx_disputes_status ON disputes(dispute_status);

CREATE TABLE evaluations (
  evaluation_id    INTEGER PRIMARY KEY,
  milestone_id     INTEGER NOT NULL REFERENCES milestones(milestone_id),
  team_id          INTEGER NOT NULL REFERENCES teams(team_id),
  evaluator_id     INTEGER NOT NULL REFERENCES users(user_id),
  evaluatee_id     INTEGER NOT NULL REFERENCES users(user_id),
  score            INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment          TEXT,
  submission_date  TEXT NOT NULL,
  UNIQUE (milestone_id, evaluator_id, evaluatee_id),
  CHECK (evaluator_id <> evaluatee_id)
);
CREATE INDEX idx_evaluations_team ON evaluations(team_id, milestone_id);

CREATE TABLE integrity_flags (
  flag_id        INTEGER PRIMARY KEY,
  milestone_id   INTEGER NOT NULL REFERENCES milestones(milestone_id),
  team_id        INTEGER NOT NULL REFERENCES teams(team_id),
  rater_id       INTEGER NOT NULL REFERENCES users(user_id),
  flag_type      TEXT NOT NULL CHECK (flag_type IN ('identical_scores', 'reciprocal_scores')),
  flag_details   TEXT CHECK (flag_details IS NULL OR length(flag_details) <= 255),
  review_status  TEXT NOT NULL DEFAULT 'open' CHECK (review_status IN ('open', 'dismissed', 'confirmed')),
  flagged_date   TEXT NOT NULL,
  UNIQUE (milestone_id, team_id, rater_id, flag_type)
);
CREATE INDEX idx_flags_team ON integrity_flags(team_id, review_status);

-- The one template the first release ships with (P05). Other templates are out of scope.
INSERT INTO project_templates (template_id, template_name, template_description, settings_explanation, default_member_access, default_anonymous_evals)
VALUES (
  1,
  'Class Group Project',
  'A semester team project: one private channel per team, work logs your students confirm for each other, and peer ratings at each milestone.',
  'Students can edit their own team''s work log. Only you can see evaluations. Students never see who rated them.',
  'write',
  1
);
