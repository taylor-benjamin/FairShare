// Class Setup Service — templates, settings, roster import, publishing and invites (Epic 1: P05–P08).
import "server-only";
import { randomToken } from "../auth/crypto";
import { authorize } from "../permissions";
import {
  charters,
  courses,
  createDraftTeams,
  deleteDraftTeams,
  deleteProject as deleteProjectRows,
  deleteTeam as deleteTeamRows,
  invitations,
  memberships,
  milestones,
  projects,
  teams,
  templates,
  users,
  type ProjectWithCourse,
} from "../data/repo";
import { sendEmail } from "../email";
import { groupRosterByTeam, isCharterComplete, isIsoDate, parseRosterCsv } from "../rules";
import type { SessionUser } from "../types";
import { authorizeTeam, NotFoundError, UserError } from "./common";

export async function listTemplates(user: SessionUser | null) {
  authorize(user, "course.create");
  return templates.list();
}

export async function listMyCourses(user: SessionUser | null) {
  authorize(user, "course.create");
  return courses.byInstructor(user.userId);
}

export async function listMyProjects(user: SessionUser | null) {
  authorize(user, "course.create");
  return projects.byInstructor(user.userId);
}

/** Loads a project and checks the user is the instructor who owns it. */
export async function getProject(user: SessionUser | null, projectId: number): Promise<ProjectWithCourse> {
  const project = Number.isInteger(projectId) ? await projects.byId(projectId) : null;
  if (!project) throw new NotFoundError("That project doesn't exist.");
  authorize(user, "course.manage", { kind: "course", instructorId: project.instructor_id });
  return project;
}

export interface NewProjectInput {
  templateId: number;
  courseId: number | null; // existing course, or null to create one from the fields below
  courseCode: string;
  courseName: string;
  sectionNumber: string;
  projectName: string;
  startDate: string;
  endDate: string;
}

/** P05 — start a project from a template. Settings start at the template's defaults. */
export async function createProject(user: SessionUser | null, input: NewProjectInput): Promise<number> {
  authorize(user, "course.create");
  const template = await templates.byId(input.templateId);
  if (!template) throw new UserError("Pick a project type to start from.");
  if (!input.projectName) throw new UserError("Give the project a name, for example “Semester Group Project”.");
  if (input.projectName.length > 100) throw new UserError("The project name can be at most 100 characters.");
  if (!isIsoDate(input.startDate) || !isIsoDate(input.endDate)) throw new UserError("Pick a start date and an end date.");
  if (input.endDate < input.startDate) throw new UserError("The end date must be on or after the start date.");

  let courseId = input.courseId;
  if (courseId) {
    const course = await courses.byId(courseId);
    if (!course) throw new UserError("Pick one of your courses.");
    authorize(user, "course.manage", { kind: "course", instructorId: course.instructor_id });
  } else {
    if (!input.courseCode || !input.courseName || !input.sectionNumber) {
      throw new UserError("Enter the course code, course name, and section number.");
    }
    if (input.courseCode.length > 20 || input.courseName.length > 100 || input.sectionNumber.length > 10) {
      throw new UserError("Course code (20), course name (100), or section (10) is too long.");
    }
    courseId = await courses.create({
      instructor_id: user.userId,
      course_code: input.courseCode,
      course_name: input.courseName,
      section_number: input.sectionNumber,
    });
  }

  return projects.create({
    course_id: courseId,
    template_id: template.template_id,
    project_name: input.projectName,
    start_date: input.startDate,
    end_date: input.endDate,
    anonymous_evals: template.default_anonymous_evals,
    member_access: template.default_member_access,
  });
}

/** P06 — validate the roster CSV and create one draft channel per team. Replaces any earlier draft import. */
export async function importRoster(user: SessionUser | null, projectId: number, csvText: string): Promise<{ errors: string[]; teamCount: number; studentCount: number }> {
  await getProject(user, projectId);
  if (csvText.length > 500_000) return { errors: ["That file is too large. A class list should be well under 500 KB."], teamCount: 0, studentCount: 0 };

  const { rows, errors } = parseRosterCsv(csvText);
  if (errors.length > 0) return { errors, teamCount: 0, studentCount: 0 };

  const existing = await teams.byProject(projectId);
  const published = existing.filter((t) => t.channel_status !== "draft").map((t) => t.team_name);
  const grouped = groupRosterByTeam(rows);
  const clash = [...grouped.keys()].filter((n) => published.includes(n));
  if (clash.length > 0) {
    return { errors: [`These teams are already published and can't be replaced: ${clash.join(", ")}.`], teamCount: 0, studentCount: 0 };
  }

  const withTokens = new Map([...grouped].map(([team, members]) => [team, members.map((m) => ({ email: m.email, token: randomToken() }))]));
  await deleteDraftTeams(projectId);
  await createDraftTeams(projectId, withTokens);
  return { errors: [], teamCount: grouped.size, studentCount: rows.length };
}

/** P07 — accept or adjust the template defaults. */
export async function saveSettings(user: SessionUser | null, projectId: number, s: { anonymous: boolean }) {
  await getProject(user, projectId);
  await projects.saveSettings(projectId, s);
}

/** Plain-language lines describing the project's current settings (P07). */
export function explainSettings(p: Pick<ProjectWithCourse, "anonymous_evals" | "default_anonymous_evals">) {
  const anonymous = (p.anonymous_evals ?? p.default_anonymous_evals) === 1;
  return {
    anonymous,
    lines: [
      "Students log their work, confirm teammates' work, and set their own role in the team charter. They can't see other teams.",
      "Only you can see evaluations. Students see the ratings they received, never the ratings their teammates gave each other.",
      anonymous
        ? "Ratings are anonymous: students never see who rated them."
        : "Ratings show names: students can see which teammate gave each rating they received.",
      "Each team channel is private to its members and you.",
    ],
  };
}

export async function getSetupOverview(user: SessionUser | null, projectId: number) {
  const project = await getProject(user, projectId);
  const teamRows = await teams.byProject(projectId);
  const withInvites = await Promise.all(teamRows.map(async (t) => ({ ...t, invitations: await invitations.byTeam(t.team_id) })));
  return { project, teams: withInvites, milestones: await milestones.byProject(projectId), settings: explainSettings(project) };
}

async function sendInviteEmail(project: ProjectWithCourse, teamName: string, inv: { invited_email: string; invite_token: string }, appUrl: string) {
  const hasAccount = !!(await users.byEmail(inv.invited_email));
  return sendEmail({
    to: inv.invited_email,
    subject: `You've been added to ${teamName} on FairShare`,
    text:
      `Hi,

${project.course_code} (Section ${project.section_number}) is using FairShare for “${project.project_name}”. ` +
      `You're on ${teamName}.

` +
      `${hasAccount ? "Join your team" : "Create your account and join your team"} here (this link works once):
${appUrl}/invite/${inv.invite_token}

` +
      `In FairShare you log the work you finish, your teammates confirm it, and your grade reflects what you actually did.
`,
  });
}

/** P08: publish every draft channel in the project and email each student a single-use sign-up link. */
export async function publishTeams(
  user: SessionUser | null,
  projectId: number,
  appUrl: string,
): Promise<{ published: number; emailed: number; delivered: number; error?: string }> {
  const project = await getProject(user, projectId);
  const drafts = (await teams.byProject(projectId)).filter((t) => t.channel_status === "draft");
  if (drafts.length === 0) throw new UserError("There are no draft teams to publish. Upload your class list first.");

  let emailed = 0;
  let delivered = 0;
  let error: string | undefined;
  for (const team of drafts) {
    await teams.setStatus(team.team_id, "published");
    for (const inv of await invitations.byTeam(team.team_id)) {
      if (inv.invite_status !== "pending") continue;
      const result = await sendInviteEmail(project, team.team_name, inv, appUrl);
      emailed++;
      if (result.delivered) delivered++;
      else error ??= result.error;
    }
  }
  return { published: drafts.length, emailed, delivered, error };
}

/** Re-sends one pending invite. Reports whether the email service accepted it. */
export async function resendInvitation(user: SessionUser | null, invitationId: number, appUrl: string) {
  const inv = Number.isInteger(invitationId) ? await invitations.byId(invitationId) : null;
  if (!inv) throw new NotFoundError("That invite doesn't exist.");
  const { team } = await authorizeTeam(user, "team.manage", inv.team_id);
  if (inv.invite_status !== "pending") throw new UserError("This student already joined.");
  if (team.channel_status === "draft") throw new UserError("Publish the team first.");
  const project = await getProject(user, team.project_id);
  return sendInviteEmail(project, team.team_name, inv, appUrl);
}

export async function addMilestone(user: SessionUser | null, projectId: number, name: string, dueDate: string) {
  await getProject(user, projectId);
  if (!name || name.length > 100) throw new UserError("Give the milestone a name (up to 100 characters).");
  if (!isIsoDate(dueDate)) throw new UserError("Pick the milestone's due date.");
  await milestones.create(projectId, name, dueDate);
}

/** Completing a milestone opens peer ratings for it. */
export async function completeMilestone(user: SessionUser | null, milestoneId: number) {
  const ms = await milestones.byId(milestoneId);
  if (!ms) throw new NotFoundError("That milestone doesn't exist.");
  await getProject(user, ms.project_id);
  await milestones.complete(milestoneId);
}

/** Closes a team channel to new work. Members can still read it. */
export async function finishTeam(user: SessionUser | null, teamId: number) {
  const { team } = await authorizeTeam(user, "team.manage", teamId);
  if (team.channel_status !== "published") throw new UserError("Only a published channel can be marked finished.");
  await teams.setStatus(teamId, "finished");
}

// ── Deleting (instructor only) ───────────────────────────────────────────────

/** The typed confirmation must match the name exactly (ignoring surrounding spaces and case). */
function confirmName(typed: string, actual: string) {
  if (typed.trim().toLowerCase() !== actual.trim().toLowerCase()) {
    throw new UserError(`To confirm, type the name exactly: ${actual}`);
  }
}

/** Permanently deletes a project, its milestones, and every team channel in it. */
export async function deleteProject(user: SessionUser | null, projectId: number, typedName: string) {
  const project = Number.isInteger(projectId) ? await projects.byId(projectId) : null;
  if (!project) throw new NotFoundError("That project doesn't exist.");
  authorize(user, "project.delete", { kind: "course", instructorId: project.instructor_id });
  confirmName(typedName, project.project_name);
  await deleteProjectRows(projectId);
  return project;
}

/** Permanently deletes one team channel and its work log, ratings, charter, tasks and invites. */
export async function deleteTeam(user: SessionUser | null, teamId: number, typedName: string) {
  const { team } = await authorizeTeam(user, "team.delete", teamId);
  confirmName(typedName, team.team_name);
  await deleteTeamRows(teamId);
  return team;
}


// ── Team membership changes after publishing (#7) ────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invites one more student to an existing team and emails them (published teams only; drafts are emailed on publish). */
export async function addStudent(user: SessionUser | null, teamId: number, emailRaw: string, appUrl: string) {
  const { team } = await authorizeTeam(user, "team.manage", teamId);
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 100) throw new UserError("Enter the student's email address.");
  const existingUser = await users.byEmail(email);
  if (existingUser?.system_role === "instructor") throw new UserError("That email belongs to an instructor account.");
  if (existingUser && (await memberships.forUser(teamId, existingUser.user_id))) throw new UserError("That student is already on this team.");
  if ((await invitations.byTeam(teamId)).some((i) => i.invite_status === "pending" && i.invited_email.toLowerCase() === email)) {
    throw new UserError("That student already has a pending invite. Use Copy link or Resend on the project page.");
  }
  const token = randomToken();
  await invitations.create(teamId, email, token);
  if (team.channel_status === "draft") return { delivered: false, draft: true as const };
  const project = await getProject(user, team.project_id);
  const result = await sendInviteEmail(project, team.team_name, { invited_email: email, invite_token: token }, appUrl);
  return { ...result, draft: false as const };
}

/** Removes a student from a team. Their logged work stays in the log; their unfinished tasks become unassigned. */
export async function removeMember(user: SessionUser | null, teamId: number, userId: number) {
  await authorizeTeam(user, "team.manage", teamId);
  if (!(await memberships.forUser(teamId, userId))) throw new NotFoundError("That student isn't on this team.");
  await memberships.remove(teamId, userId);
  // Removing the last student without a role can complete the charter.
  const remaining = await memberships.byTeam(teamId);
  if (await charters.byTeam(teamId)) await charters.setCompleted(teamId, isCharterComplete(remaining));
}

/** Cancels a pending invite so its link stops working. */
export async function cancelInvitation(user: SessionUser | null, invitationId: number) {
  const inv = Number.isInteger(invitationId) ? await invitations.byId(invitationId) : null;
  if (!inv) throw new NotFoundError("That invite doesn't exist.");
  await authorizeTeam(user, "team.manage", inv.team_id);
  if (inv.invite_status !== "pending") throw new UserError("This invite was already used or cancelled.");
  await invitations.expire(invitationId);
}

/** Members and pending invites for the instructor's team page. */
export async function getTeamRoster(user: SessionUser | null, teamId: number) {
  const { team } = await authorizeTeam(user, "team.manage", teamId);
  const [members, invites] = await Promise.all([memberships.byTeam(teamId), invitations.byTeam(teamId)]);
  return { team, members, pending: invites.filter((i) => i.invite_status === "pending") };
}
