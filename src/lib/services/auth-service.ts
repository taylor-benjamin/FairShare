// Authentication service: sign-up, log-in, invite acceptance (P02, P08).
import "server-only";
import { hashPassword, verifyPassword } from "../auth/crypto";
import { endSession, startSession, toSessionUser } from "../auth/session";
import { invitations, projects, users } from "../data/repo";
import { sendEmail } from "../email";
import type { SessionUser } from "../types";
import { loadTeam, UserError } from "./common";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A real hash to compare against when the email is unknown, so response time doesn't reveal which emails exist.
let dummyHash: string | null = null;

function checkPassword(pw: string) {
  if (pw.length < 8) throw new UserError("Choose a password with at least 8 characters.");
  if (pw.length > 200) throw new UserError("That password is too long.");
}

function checkName(first: string, last: string) {
  if (!first || !last) throw new UserError("Please enter your first and last name.");
  if (first.length > 50 || last.length > 50) throw new UserError("Names can be at most 50 characters.");
}

export async function logIn(email: string, password: string): Promise<SessionUser> {
  const row = await users.byEmail(email);
  if (!row) {
    dummyHash ??= await hashPassword("not-a-real-password");
    await verifyPassword(password, dummyHash);
    throw new UserError("That email and password don't match an account.");
  }
  if (!(await verifyPassword(password, row.password_hash))) {
    throw new UserError("That email and password don't match an account.");
  }
  await startSession(row.user_id);
  return toSessionUser(row);
}

export async function logOut(): Promise<void> {
  await endSession();
}

/**
 * Open sign-up is for instructors and viewers. Students join through the invite link their
 * instructor's roster sends, so they land in the right team automatically.
 */
export async function signUp(input: { firstName: string; lastName: string; email: string; password: string; role: "instructor" | "viewer"; appUrl: string }): Promise<SessionUser> {
  const email = input.email.trim().toLowerCase();
  checkName(input.firstName, input.lastName);
  if (!EMAIL_RE.test(email) || email.length > 100) throw new UserError("Please enter a valid email address.");
  checkPassword(input.password);
  if (input.role !== "instructor" && input.role !== "viewer") throw new UserError("Pick an account type.");
  if (await users.byEmail(email)) throw new UserError("An account with that email already exists. Try logging in instead.");

  const id = await users.create({
    first_name: input.firstName,
    last_name: input.lastName,
    email,
    password_hash: await hashPassword(input.password),
    system_role: input.role,
  });
  await sendEmail({
    to: email,
    subject: "Welcome to FairShare",
    text:
      `Hi ${input.firstName},\n\nYour FairShare ${input.role} account is ready. Log in any time at ${input.appUrl}/login\n\n` +
      (input.role === "instructor"
        ? "To start, click “Set up a class project”. It takes about ten minutes with your class list from Moodle.\n"
        : "You can browse every team channel that has been shared publicly.\n"),
  });
  await startSession(id);
  const row = await users.byId(id);
  return toSessionUser(row!);
}

export interface InviteInfo {
  status: "pending" | "accepted" | "expired" | "not_found" | "not_ready";
  email?: string;
  teamName?: string;
  courseLabel?: string;
  hasAccount?: boolean;
}

/** Public read of an invite link — shows only what the invitee needs to accept it. */
export async function describeInvite(token: string): Promise<InviteInfo> {
  const inv = token ? await invitations.byToken(token) : null;
  if (!inv) return { status: "not_found" };
  const { team } = await loadTeam(null, inv.team_id);
  if (team.channel_status === "draft") return { status: "not_ready" };
  return {
    status: inv.invite_status,
    email: inv.invited_email,
    teamName: team.team_name,
    courseLabel: `${team.course_code} · Section ${team.section_number} · ${team.project_name}`,
    hasAccount: !!(await users.byEmail(inv.invited_email)),
  };
}

/**
 * Accepting a single-use invite creates the student account (or signs in an existing one)
 * and adds the membership with the project's default access level.
 */
export async function acceptInvite(token: string, input: { firstName: string; lastName: string; password: string }): Promise<number> {
  const inv = await invitations.byToken(token);
  if (!inv) throw new UserError("This invite link isn't valid. Ask your instructor to resend it.");
  if (inv.invite_status !== "pending") throw new UserError("This invite link has already been used. Log in instead.");
  const { team } = await loadTeam(null, inv.team_id);
  if (team.channel_status === "draft") throw new UserError("Your instructor hasn't opened this team yet.");

  let user = await users.byEmail(inv.invited_email);
  if (user) {
    if (user.system_role !== "student") throw new UserError("This email belongs to a non-student account. Ask your instructor to use a different email.");
    if (!(await verifyPassword(input.password, user.password_hash))) throw new UserError("That password doesn't match your existing FairShare account.");
  } else {
    checkName(input.firstName, input.lastName);
    checkPassword(input.password);
    const id = await users.create({
      first_name: input.firstName,
      last_name: input.lastName,
      email: inv.invited_email,
      password_hash: await hashPassword(input.password),
      system_role: "student",
    });
    user = await users.byId(id);
  }

  const project = await projects.byId(team.project_id);
  const accessLevel = project?.member_access ?? project?.default_member_access ?? "write";
  await invitations.accept(inv.invitation_id, team.team_id, user!.user_id, accessLevel);
  await startSession(user!.user_id);
  return team.team_id;
}
