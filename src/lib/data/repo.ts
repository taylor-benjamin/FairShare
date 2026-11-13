// Repository functions: plain SQL with .bind() parameters. No permission logic lives here —
// services decide *whether* to call these; this layer only knows *how* to read and write.
import "server-only";
import { all, batch, first, now, run, stmt } from "./client";
import type {
  AccessLevel,
  CharterRow,
  ContributionRow,
  CourseRow,
  DisputeRow,
  EvaluationRow,
  FlagRow,
  InvitationRow,
  MembershipRow,
  MilestoneRow,
  ProjectRow,
  SystemRole,
  TaskRow,
  TeamRow,
  TemplateRow,
  UserRow,
  VerificationStatus,
} from "../types";

export { now };

// ── Users ────────────────────────────────────────────────────────────────────

export const users = {
  byId: (id: number) => first<UserRow>("SELECT * FROM users WHERE user_id = ?", id),
  byEmail: (email: string) => first<UserRow>("SELECT * FROM users WHERE email = ? COLLATE NOCASE", email.trim()),
  setRole: (userId: number, role: SystemRole) => run("UPDATE users SET system_role = ? WHERE user_id = ?", role, userId),
  markResetRequested: (userId: number) => run("UPDATE users SET reset_requested_date = ? WHERE user_id = ?", now(), userId),
  setPassword: (userId: number, passwordHash: string) => run("UPDATE users SET password_hash = ? WHERE user_id = ?", passwordHash, userId),
  create: (u: { first_name: string; last_name: string; email: string; password_hash: string; system_role: SystemRole }) =>
    run(
      "INSERT INTO users (first_name, last_name, email, password_hash, system_role, created_date) VALUES (?, ?, ?, ?, ?, ?)",
      u.first_name,
      u.last_name,
      u.email.trim().toLowerCase(),
      u.password_hash,
      u.system_role,
      now(),
    ),
};

// ── Sessions (migration 0003) ────────────────────────────────────────────────

export const sessions = {
  create: (sessionId: string, userId: number, expiresIso: string) =>
    run("INSERT INTO sessions (session_id, user_id, created_date, expires_date) VALUES (?, ?, ?, ?)", sessionId, userId, now(), expiresIso),
  /** True only if the session row exists, belongs to the user, and hasn't expired. */
  isValid: async (sessionId: string, userId: number) =>
    !!(await first<{ n: number }>("SELECT 1 AS n FROM sessions WHERE session_id = ? AND user_id = ? AND expires_date > ?", sessionId, userId, now())),
  remove: (sessionId: string) => run("DELETE FROM sessions WHERE session_id = ?", sessionId),
  /** Ends every login for this user (password reset). */
  removeAllForUser: (userId: number) => run("DELETE FROM sessions WHERE user_id = ?", userId),
  removeExpiredForUser: (userId: number) => run("DELETE FROM sessions WHERE user_id = ? AND expires_date <= ?", userId, now()),
};

// ── Courses, templates, projects, milestones ─────────────────────────────────

export const courses = {
  byId: (id: number) => first<CourseRow>("SELECT * FROM courses WHERE course_id = ?", id),
  byInstructor: (instructorId: number) =>
    all<CourseRow>("SELECT * FROM courses WHERE instructor_id = ? ORDER BY course_code, section_number", instructorId),
  create: (c: Omit<CourseRow, "course_id">) =>
    run(
      "INSERT INTO courses (instructor_id, course_code, course_name, section_number) VALUES (?, ?, ?, ?)",
      c.instructor_id,
      c.course_code,
      c.course_name,
      c.section_number,
    ),
};

export const templates = {
  list: () => all<TemplateRow>("SELECT * FROM project_templates ORDER BY template_id"),
  byId: (id: number) => first<TemplateRow>("SELECT * FROM project_templates WHERE template_id = ?", id),
};

export type ProjectWithCourse = ProjectRow &
  CourseRow & { template_name: string; default_member_access: AccessLevel; default_anonymous_evals: number; settings_explanation: string | null };

export const projects = {
  byId: (id: number) =>
    first<ProjectWithCourse>(
      `SELECT p.*, c.instructor_id, c.course_code, c.course_name, c.section_number, t.template_name, t.default_member_access, t.default_anonymous_evals, t.settings_explanation
       FROM projects p JOIN courses c ON c.course_id = p.course_id JOIN project_templates t ON t.template_id = p.template_id
       WHERE p.project_id = ?`,
      id,
    ),
  byInstructor: (instructorId: number) =>
    all<ProjectWithCourse>(
      `SELECT p.*, c.instructor_id, c.course_code, c.course_name, c.section_number, t.template_name, t.default_member_access, t.default_anonymous_evals, t.settings_explanation
       FROM projects p JOIN courses c ON c.course_id = p.course_id JOIN project_templates t ON t.template_id = p.template_id
       WHERE c.instructor_id = ? ORDER BY p.start_date DESC, p.project_id DESC`,
      instructorId,
    ),
  create: (p: Omit<ProjectRow, "project_id">) =>
    run(
      "INSERT INTO projects (course_id, template_id, project_name, start_date, end_date, anonymous_evals, member_access) VALUES (?, ?, ?, ?, ?, ?, ?)",
      p.course_id,
      p.template_id,
      p.project_name,
      p.start_date,
      p.end_date,
      p.anonymous_evals,
      p.member_access,
    ),
  saveSettings: (projectId: number, s: { anonymous: boolean }) =>
    run("UPDATE projects SET anonymous_evals = ?, member_access = 'write' WHERE project_id = ?", s.anonymous ? 1 : 0, projectId),
};

export const milestones = {
  byId: (id: number) => first<MilestoneRow>("SELECT * FROM milestones WHERE milestone_id = ?", id),
  byProject: (projectId: number) => all<MilestoneRow>("SELECT * FROM milestones WHERE project_id = ? ORDER BY due_date, milestone_id", projectId),
  create: (projectId: number, name: string, dueDate: string) =>
    run("INSERT INTO milestones (project_id, milestone_name, due_date, milestone_status) VALUES (?, ?, ?, 'open')", projectId, name, dueDate),
  complete: (id: number) => run("UPDATE milestones SET milestone_status = 'completed', completion_date = ? WHERE milestone_id = ? AND milestone_status = 'open'", now(), id),
};

// ── Teams, memberships, invitations ──────────────────────────────────────────

/** Everything the permission check needs to know about a team, from the database. */
export interface TeamContextRow extends TeamRow {
  instructor_id: number;
  course_id: number;
  course_code: string;
  course_name: string;
  section_number: string;
  project_name: string;
  anonymous_evals: number | null;
}

export const teams = {
  context: (teamId: number) =>
    first<TeamContextRow>(
      `SELECT t.*, c.instructor_id, c.course_id, c.course_code, c.course_name, c.section_number, p.project_name, p.anonymous_evals
       FROM teams t JOIN projects p ON p.project_id = t.project_id JOIN courses c ON c.course_id = p.course_id
       WHERE t.team_id = ?`,
      teamId,
    ),
  byProject: (projectId: number) => all<TeamRow>("SELECT * FROM teams WHERE project_id = ? ORDER BY team_name", projectId),
  forStudent: (userId: number) =>
    all<TeamContextRow & { access_level: AccessLevel }>(
      `SELECT t.*, c.instructor_id, c.course_id, c.course_code, c.course_name, c.section_number, p.project_name, p.anonymous_evals, m.access_level
       FROM team_memberships m JOIN teams t ON t.team_id = m.team_id JOIN projects p ON p.project_id = t.project_id
       JOIN courses c ON c.course_id = p.course_id
       WHERE m.user_id = ? AND t.channel_status <> 'draft' ORDER BY t.creation_date DESC`,
      userId,
    ),
  setStatus: (teamId: number, status: "published" | "finished") => run("UPDATE teams SET channel_status = ? WHERE team_id = ?", status, teamId),
};

export type MemberWithUser = MembershipRow & { first_name: string; last_name: string; email: string };

export const memberships = {
  forUser: (teamId: number, userId: number) =>
    first<MembershipRow>("SELECT * FROM team_memberships WHERE team_id = ? AND user_id = ?", teamId, userId),
  byTeam: (teamId: number) =>
    all<MemberWithUser>(
      `SELECT m.*, u.first_name, u.last_name, u.email FROM team_memberships m JOIN users u ON u.user_id = m.user_id
       WHERE m.team_id = ? ORDER BY m.joined_date, u.first_name`,
      teamId,
    ),
  /** A student sets their own charter role; setting it is their confirmation. */
  setOwnRole: (teamId: number, userId: number, role: string) =>
    run("UPDATE team_memberships SET team_role = ?, role_confirmed = 1 WHERE team_id = ? AND user_id = ?", role, teamId, userId),
  /** #7: remove a student from a team. Their logged work stays in the log; their open tasks become unassigned. */
  remove: (teamId: number, userId: number) =>
    batch([
      stmt("UPDATE tasks SET user_id = NULL WHERE team_id = ? AND user_id = ? AND task_status <> 'done'", teamId, userId),
      stmt("DELETE FROM team_memberships WHERE team_id = ? AND user_id = ?", teamId, userId),
    ]),
};

export const invitations = {
  byId: (id: number) => first<InvitationRow>("SELECT * FROM invitations WHERE invitation_id = ?", id),
  byToken: (token: string) => first<InvitationRow>("SELECT * FROM invitations WHERE invite_token = ?", token),
  byTeam: (teamId: number) => all<InvitationRow>("SELECT * FROM invitations WHERE team_id = ? ORDER BY invited_email", teamId),
  /** Accepting marks the invite used and adds the membership in one transaction. */
  accept: (invitationId: number, teamId: number, userId: number) => {
    const ts = now();
    return batch([
      stmt("UPDATE invitations SET invite_status = 'accepted', accepted_date = ? WHERE invitation_id = ? AND invite_status = 'pending'", ts, invitationId),
      stmt(
        "INSERT OR IGNORE INTO team_memberships (team_id, user_id, access_level, role_confirmed, joined_date) VALUES (?, ?, 'write', 0, ?)",
        teamId,
        userId,
        ts,
      ),
      // A new member hasn't set a role yet, so the charter is no longer complete.
      stmt(
        `UPDATE team_charters SET completed_date = NULL WHERE team_id = ?
         AND EXISTS (SELECT 1 FROM team_memberships WHERE team_id = ? AND user_id = ? AND team_role IS NULL)`,
        teamId,
        teamId,
        userId,
      ),
    ]);
  },
  /** #7: invite one more student to an existing team. */
  create: (teamId: number, email: string, token: string) =>
    run(
      "INSERT INTO invitations (team_id, invited_email, invite_token, invite_status, date_received) VALUES (?, ?, ?, 'pending', ?)",
      teamId,
      email,
      token,
      now(),
    ),
  /** #7: cancel a pending invite (its link stops working). */
  expire: (invitationId: number) => run("UPDATE invitations SET invite_status = 'expired' WHERE invitation_id = ? AND invite_status = 'pending'", invitationId),
};

/** Creates draft teams and their pending invitations in one transaction (P06). */
export async function createDraftTeams(projectId: number, roster: Map<string, { email: string; token: string }[]>): Promise<void> {
  const ts = now();
  const statements = [];
  for (const [teamName, members] of roster) {
    statements.push(
      stmt("INSERT INTO teams (project_id, team_name, channel_status, visibility, creation_date) VALUES (?, ?, 'draft', 'private', ?)", projectId, teamName, ts),
    );
    for (const m of members) {
      statements.push(
        stmt(
          `INSERT INTO invitations (team_id, invited_email, invite_token, invite_status, date_received)
           VALUES ((SELECT team_id FROM teams WHERE project_id = ? AND team_name = ?), ?, ?, 'pending', ?)`,
          projectId,
          teamName,
          m.email,
          m.token,
          ts,
        ),
      );
    }
  }
  await batch(statements);
}

/**
 * Removes every row that belongs to the teams selected by `teamIds` (a subquery), children first,
 * because the schema has no ON DELETE CASCADE. Callers wrap these in one batch so it's all-or-nothing.
 * User accounts are kept — a student may be on other teams.
 */
function teamDeleteStatements(teamIds: string, params: unknown[]) {
  const contribs = `SELECT contribution_id FROM contributions WHERE team_id IN (${teamIds})`;
  return [
    stmt(`DELETE FROM integrity_flags WHERE team_id IN (${teamIds})`, ...params),
    stmt(`DELETE FROM evaluations WHERE team_id IN (${teamIds})`, ...params),
    stmt(`DELETE FROM disputes WHERE verification_id IN (SELECT verification_id FROM verifications WHERE contribution_id IN (${contribs}))`, ...params),
    stmt(`DELETE FROM verifications WHERE contribution_id IN (${contribs})`, ...params),
    stmt(`DELETE FROM contributions WHERE team_id IN (${teamIds})`, ...params),
    stmt(`DELETE FROM task_reassignments WHERE task_id IN (SELECT task_id FROM tasks WHERE team_id IN (${teamIds}))`, ...params),
    stmt(`DELETE FROM tasks WHERE team_id IN (${teamIds})`, ...params),
    stmt(`DELETE FROM team_charters WHERE team_id IN (${teamIds})`, ...params),
    stmt(`DELETE FROM invitations WHERE team_id IN (${teamIds})`, ...params),
    stmt(`DELETE FROM team_memberships WHERE team_id IN (${teamIds})`, ...params),
    stmt(`DELETE FROM teams WHERE team_id IN (${teamIds})`, ...params),
  ];
}

/** Permanently deletes one team channel and everything in it, in a single transaction. */
export async function deleteTeam(teamId: number): Promise<void> {
  await batch(teamDeleteStatements("?", [teamId]));
}

/** Permanently deletes a project: all its teams (as above), then its milestones and the project row. */
export async function deleteProject(projectId: number): Promise<void> {
  await batch([
    ...teamDeleteStatements("SELECT team_id FROM teams WHERE project_id = ?", [projectId]),
    // Flags/evaluations are tied to teams too, but clear any stragglers tied only to this project's milestones.
    stmt("DELETE FROM integrity_flags WHERE milestone_id IN (SELECT milestone_id FROM milestones WHERE project_id = ?)", projectId),
    stmt("DELETE FROM evaluations WHERE milestone_id IN (SELECT milestone_id FROM milestones WHERE project_id = ?)", projectId),
    stmt("DELETE FROM milestones WHERE project_id = ?", projectId),
    stmt("DELETE FROM projects WHERE project_id = ?", projectId),
  ]);
}

export async function deleteDraftTeams(projectId: number): Promise<void> {
  await batch([
    stmt("DELETE FROM invitations WHERE team_id IN (SELECT team_id FROM teams WHERE project_id = ? AND channel_status = 'draft')", projectId),
    stmt("DELETE FROM teams WHERE project_id = ? AND channel_status = 'draft'", projectId),
  ]);
}

// ── Charters and tasks ───────────────────────────────────────────────────────

export const charters = {
  byTeam: (teamId: number) => first<CharterRow>("SELECT * FROM team_charters WHERE team_id = ?", teamId),
  upsert: (teamId: number, goals: string, expectations: string) =>
    run(
      `INSERT INTO team_charters (team_id, team_goals, expectations, created_date) VALUES (?, ?, ?, ?)
       ON CONFLICT(team_id) DO UPDATE SET team_goals = excluded.team_goals, expectations = excluded.expectations`,
      teamId,
      goals,
      expectations,
      now(),
    ),
  setCompleted: (teamId: number, completed: boolean) =>
    completed
      ? run("UPDATE team_charters SET completed_date = COALESCE(completed_date, ?) WHERE team_id = ?", now(), teamId)
      : run("UPDATE team_charters SET completed_date = NULL WHERE team_id = ?", teamId),
};

export type TaskWithOwner = TaskRow & { owner_first: string | null; owner_last: string | null };

export const tasks = {
  byId: (id: number) => first<TaskRow>("SELECT * FROM tasks WHERE task_id = ?", id),
  byTeam: (teamId: number) =>
    all<TaskWithOwner>(
      `SELECT t.*, u.first_name AS owner_first, u.last_name AS owner_last FROM tasks t LEFT JOIN users u ON u.user_id = t.user_id
       WHERE t.team_id = ? ORDER BY CASE t.task_status WHEN 'done' THEN 1 ELSE 0 END, t.due_date IS NULL, t.due_date, t.task_id`,
      teamId,
    ),
  create: (t: Omit<TaskRow, "task_id">) =>
    run("INSERT INTO tasks (team_id, user_id, task_title, due_date, task_status) VALUES (?, ?, ?, ?, ?)", t.team_id, t.user_id, t.task_title, t.due_date, t.task_status),
  setStatus: (id: number, status: TaskRow["task_status"]) => run("UPDATE tasks SET task_status = ? WHERE task_id = ?", status, id),
  /** P13 — move the task and record the history in one transaction. */
  reassign: (taskId: number, fromUserId: number, toUserId: number, byId: number, reason: string) =>
    batch([
      stmt("UPDATE tasks SET user_id = ? WHERE task_id = ?", toUserId, taskId),
      stmt(
        `INSERT INTO task_reassignments (task_id, from_user_id, to_user_id, reassigned_by_id, reassignment_reason, reassigned_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        taskId,
        fromUserId,
        toUserId,
        byId,
        reason,
        now(),
      ),
    ]),
  reassignmentsByTeam: (teamId: number) =>
    all<{
      reassignment_id: number;
      task_title: string;
      reassignment_reason: string;
      reassigned_date: string;
      from_name: string;
      to_name: string;
    }>(
      `SELECT r.reassignment_id, t.task_title, r.reassignment_reason, r.reassigned_date,
              uf.first_name || ' ' || uf.last_name AS from_name, ut.first_name || ' ' || ut.last_name AS to_name
       FROM task_reassignments r JOIN tasks t ON t.task_id = r.task_id
       JOIN users uf ON uf.user_id = r.from_user_id JOIN users ut ON ut.user_id = r.to_user_id
       WHERE t.team_id = ? ORDER BY r.reassigned_date DESC`,
      teamId,
    ),
};

// ── Contributions, verifications, disputes ───────────────────────────────────

export interface FeedRow extends ContributionRow {
  first_name: string;
  last_name: string;
  task_title: string | null;
  confirm_count: number;
  dispute_reason: string | null;
  dispute_status: string | null;
}

export const contributions = {
  byId: (id: number) => first<ContributionRow>("SELECT * FROM contributions WHERE contribution_id = ?", id),
  feed: (teamId: number) =>
    all<FeedRow>(
      `SELECT c.*, u.first_name, u.last_name, t.task_title,
              (SELECT COUNT(*) FROM verifications v WHERE v.contribution_id = c.contribution_id AND v.decision = 'confirm') AS confirm_count,
              (SELECT v.reason FROM verifications v WHERE v.contribution_id = c.contribution_id AND v.decision = 'dispute' ORDER BY v.decision_date LIMIT 1) AS dispute_reason,
              (SELECT d.dispute_status FROM verifications v JOIN disputes d ON d.verification_id = v.verification_id
                 WHERE v.contribution_id = c.contribution_id ORDER BY d.opened_date DESC LIMIT 1) AS dispute_status
       FROM contributions c JOIN users u ON u.user_id = c.user_id LEFT JOIN tasks t ON t.task_id = c.task_id
       WHERE c.team_id = ? ORDER BY c.logged_date DESC, c.contribution_id DESC`,
      teamId,
    ),
  myDecisions: (teamId: number, userId: number) =>
    all<{ contribution_id: number; decision: string }>(
      `SELECT v.contribution_id, v.decision FROM verifications v JOIN contributions c ON c.contribution_id = v.contribution_id
       WHERE c.team_id = ? AND v.verifier_id = ?`,
      teamId,
      userId,
    ),
  decisionsFor: (contributionId: number) =>
    all<{ decision: "confirm" | "dispute" }>("SELECT decision FROM verifications WHERE contribution_id = ?", contributionId),
  create: (c: Omit<ContributionRow, "contribution_id" | "verification_status" | "logged_date">) =>
    run(
      `INSERT INTO contributions (team_id, user_id, task_id, description, hours_spent, completion_date, verification_status, logged_date)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      c.team_id,
      c.user_id,
      c.task_id,
      c.description,
      c.hours_spent,
      c.completion_date,
      now(),
    ),
  addVerification: (contributionId: number, verifierId: number, decision: "confirm" | "dispute", reason: string | null) =>
    run(
      "INSERT INTO verifications (contribution_id, verifier_id, decision, reason, decision_date) VALUES (?, ?, ?, ?, ?)",
      contributionId,
      verifierId,
      decision,
      reason,
      now(),
    ),
  setStatus: (contributionId: number, status: VerificationStatus) =>
    run("UPDATE contributions SET verification_status = ? WHERE contribution_id = ?", status, contributionId),
  /**
   * Records a confirm and, in the same transaction, marks the entry confirmed once confirms are a strict
   * majority of the other members. Counting inside the batch means simultaneous confirms can't miss each other.
   * (Same rule as nextVerificationStatus in rules.ts.)
   */
  recordConfirm: (contributionId: number, verifierId: number, otherMemberCount: number) =>
    batch([
      stmt(
        "INSERT INTO verifications (contribution_id, verifier_id, decision, reason, decision_date) VALUES (?, ?, 'confirm', NULL, ?)",
        contributionId,
        verifierId,
        now(),
      ),
      stmt(
        `UPDATE contributions SET verification_status = 'confirmed'
         WHERE contribution_id = ? AND verification_status = 'pending'
           AND ? > 0
           AND (SELECT COUNT(*) FROM verifications WHERE contribution_id = ? AND decision = 'confirm') * 2 > ?`,
        contributionId,
        otherMemberCount,
        contributionId,
        otherMemberCount,
      ),
    ]),
  /** A dispute decision, the instructor's dispute case, and the disputed status — all in one transaction. */
  recordDispute: (contributionId: number, verifierId: number, reason: string) => {
    const ts = now();
    return batch([
      stmt(
        "INSERT INTO verifications (contribution_id, verifier_id, decision, reason, decision_date) VALUES (?, ?, 'dispute', ?, ?)",
        contributionId,
        verifierId,
        reason,
        ts,
      ),
      stmt(
        `INSERT INTO disputes (verification_id, dispute_status, opened_date)
         SELECT verification_id, 'open', ? FROM verifications WHERE contribution_id = ? AND verifier_id = ?`,
        ts,
        contributionId,
        verifierId,
      ),
      stmt("UPDATE contributions SET verification_status = 'disputed' WHERE contribution_id = ?", contributionId),
    ]);
  },
  /** Latest logged_date per member of a team (early warning). */
  lastLoggedByMember: (teamId: number) =>
    all<{ user_id: number; last_logged: string | null }>(
      `SELECT m.user_id, MAX(c.logged_date) AS last_logged FROM team_memberships m
       LEFT JOIN contributions c ON c.user_id = m.user_id AND c.team_id = m.team_id
       WHERE m.team_id = ? GROUP BY m.user_id`,
      teamId,
    ),
  hoursByMember: (teamId: number) =>
    all<{ user_id: number; confirmed_hours: number; confirmed_count: number; pending_count: number; disputed_count: number }>(
      `SELECT m.user_id,
              COALESCE(SUM(CASE WHEN c.verification_status = 'confirmed' THEN c.hours_spent END), 0) AS confirmed_hours,
              COUNT(CASE WHEN c.verification_status = 'confirmed' THEN 1 END) AS confirmed_count,
              COUNT(CASE WHEN c.verification_status = 'pending' THEN 1 END) AS pending_count,
              COUNT(CASE WHEN c.verification_status = 'disputed' THEN 1 END) AS disputed_count
       FROM team_memberships m LEFT JOIN contributions c ON c.user_id = m.user_id AND c.team_id = m.team_id
       WHERE m.team_id = ? GROUP BY m.user_id`,
      teamId,
    ),
};

export interface DisputeQueueRow extends DisputeRow {
  contribution_id: number;
  description: string;
  hours_spent: number | null;
  completion_date: string;
  team_id: number;
  team_name: string;
  course_code: string;
  section_number: string;
  author_name: string;
  disputer_name: string;
  reason: string;
}

export const disputes = {
  open: (verificationId: number) =>
    run("INSERT INTO disputes (verification_id, dispute_status, opened_date) VALUES (?, 'open', ?)", verificationId, now()),
  byId: (id: number) =>
    first<DisputeRow & { contribution_id: number; team_id: number }>(
      `SELECT d.*, v.contribution_id, c.team_id FROM disputes d JOIN verifications v ON v.verification_id = d.verification_id
       JOIN contributions c ON c.contribution_id = v.contribution_id WHERE d.dispute_id = ?`,
      id,
    ),
  queueForInstructor: (instructorId: number, status: "open" | "resolved") =>
    all<DisputeQueueRow>(
      `SELECT d.*, c.contribution_id, c.description, c.hours_spent, c.completion_date, c.team_id, t.team_name,
              co.course_code, co.section_number, ua.first_name || ' ' || ua.last_name AS author_name,
              uv.first_name || ' ' || uv.last_name AS disputer_name, v.reason
       FROM disputes d JOIN verifications v ON v.verification_id = d.verification_id
       JOIN contributions c ON c.contribution_id = v.contribution_id JOIN teams t ON t.team_id = c.team_id
       JOIN projects p ON p.project_id = t.project_id JOIN courses co ON co.course_id = p.course_id
       JOIN users ua ON ua.user_id = c.user_id JOIN users uv ON uv.user_id = v.verifier_id
       WHERE co.instructor_id = ? AND ${status === "open" ? "d.dispute_status = 'open'" : "d.dispute_status <> 'open'"}
       ORDER BY d.opened_date ${status === "open" ? "ASC" : "DESC"}`,
      instructorId,
    ),
  openCountByTeam: (teamId: number) =>
    first<{ n: number }>(
      `SELECT COUNT(*) AS n FROM disputes d JOIN verifications v ON v.verification_id = d.verification_id
       JOIN contributions c ON c.contribution_id = v.contribution_id WHERE c.team_id = ? AND d.dispute_status = 'open'`,
      teamId,
    ),
  resolve: (disputeId: number, contributionId: number, resolvedById: number, status: "upheld" | "rejected", note: string, contributionStatus: VerificationStatus) => {
    const ts = now();
    return batch([
      stmt(
        "UPDATE disputes SET dispute_status = ?, resolution_note = ?, resolved_by_id = ?, resolved_date = ? WHERE dispute_id = ? AND dispute_status = 'open'",
        status,
        note,
        resolvedById,
        ts,
        disputeId,
      ),
      stmt("UPDATE contributions SET verification_status = ? WHERE contribution_id = ?", contributionStatus, contributionId),
    ]);
  },
};

// ── Evaluations and integrity flags ──────────────────────────────────────────

export const evaluations = {
  byTeamMilestone: (teamId: number, milestoneId: number) =>
    all<EvaluationRow>("SELECT * FROM evaluations WHERE team_id = ? AND milestone_id = ?", teamId, milestoneId),
  byTeamCompleted: (teamId: number) =>
    all<EvaluationRow>(
      `SELECT e.* FROM evaluations e JOIN milestones ms ON ms.milestone_id = e.milestone_id
       WHERE e.team_id = ? AND ms.milestone_status = 'completed'`,
      teamId,
    ),
  givenBy: (teamId: number, evaluatorId: number) =>
    all<EvaluationRow>("SELECT * FROM evaluations WHERE team_id = ? AND evaluator_id = ?", teamId, evaluatorId),
  receivedBy: (teamId: number, evaluateeId: number) =>
    all<EvaluationRow & { milestone_name: string; evaluator_first: string; evaluator_last: string }>(
      `SELECT e.*, ms.milestone_name, u.first_name AS evaluator_first, u.last_name AS evaluator_last
       FROM evaluations e JOIN milestones ms ON ms.milestone_id = e.milestone_id JOIN users u ON u.user_id = e.evaluator_id
       WHERE e.team_id = ? AND e.evaluatee_id = ? ORDER BY ms.due_date, e.submission_date`,
      teamId,
      evaluateeId,
    ),
  /** Saves one rater's full set for a milestone atomically. */
  saveSet: (milestoneId: number, teamId: number, evaluatorId: number, ratings: { evaluateeId: number; score: number; comment: string | null }[]) => {
    const ts = now();
    return batch(
      ratings.map((r) =>
        stmt(
          `INSERT INTO evaluations (milestone_id, team_id, evaluator_id, evaluatee_id, score, comment, submission_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          milestoneId,
          teamId,
          evaluatorId,
          r.evaluateeId,
          r.score,
          r.comment,
          ts,
        ),
      ),
    );
  },
};

export type FlagWithNames = FlagRow & {
  rater_name: string;
  team_name: string;
  milestone_name: string;
  course_code: string;
  section_number: string;
};

export const flags = {
  byId: (id: number) => first<FlagRow>("SELECT * FROM integrity_flags WHERE flag_id = ?", id),
  insertIfNew: (f: { milestoneId: number; teamId: number; raterId: number; type: string; details: string }) =>
    run(
      `INSERT OR IGNORE INTO integrity_flags (milestone_id, team_id, rater_id, flag_type, flag_details, review_status, flagged_date)
       VALUES (?, ?, ?, ?, ?, 'open', ?)`,
      f.milestoneId,
      f.teamId,
      f.raterId,
      f.type,
      f.details.slice(0, 255),
      now(),
    ),
  forInstructor: (instructorId: number, status: "open" | "reviewed") =>
    all<FlagWithNames>(
      `SELECT f.*, u.first_name || ' ' || u.last_name AS rater_name, t.team_name, ms.milestone_name, co.course_code, co.section_number
       FROM integrity_flags f JOIN users u ON u.user_id = f.rater_id JOIN teams t ON t.team_id = f.team_id
       JOIN milestones ms ON ms.milestone_id = f.milestone_id JOIN projects p ON p.project_id = t.project_id
       JOIN courses co ON co.course_id = p.course_id
       WHERE co.instructor_id = ? AND ${status === "open" ? "f.review_status = 'open'" : "f.review_status <> 'open'"}
       ORDER BY f.flagged_date DESC`,
      instructorId,
    ),
  openCountByTeam: (teamId: number) => first<{ n: number }>("SELECT COUNT(*) AS n FROM integrity_flags WHERE team_id = ? AND review_status = 'open'", teamId),
  review: (flagId: number, status: "dismissed" | "confirmed") =>
    run("UPDATE integrity_flags SET review_status = ? WHERE flag_id = ? AND review_status = 'open'", status, flagId),
};
