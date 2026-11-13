// Contribution Service — log work, confirm/dispute, dispute queue (Epic 2: P09–P11) and team tasks.
import "server-only";
import { authorize, can } from "../permissions";
import { contributions, disputes, memberships, tasks, type FeedRow } from "../data/repo";
import { isIsoDate, statusAfterDisputeResolution, validateHours } from "../rules";
import type { SessionUser, TaskStatus } from "../types";
import { authorizeTeam, NotFoundError, shortName, UserError } from "./common";

export interface FeedItem extends FeedRow {
  authorShort: string;
  /** Show Confirm/Dispute buttons: teammate with write access who hasn't decided and isn't the author. */
  canVerify: boolean;
  myDecision: string | null;
  isMine: boolean;
  confirmsNeeded: number;
}

/** Everything the Team Channel screen needs. Read access is checked once here. */
export async function getChannel(user: SessionUser | null, teamId: number) {
  const { team, resource } = await authorizeTeam(user, "team.read", teamId);
  const canWrite = can(user, "team.write", resource);
  const members = await memberships.byTeam(teamId);
  const writers = members.filter((m) => m.access_level === "write");
  const [feed, mine, teamTasks] = await Promise.all([
    contributions.feed(teamId),
    canWrite ? contributions.myDecisions(teamId, user!.userId) : Promise.resolve([]),
    tasks.byTeam(teamId),
  ]);
  const decided = new Map(mine.map((d) => [d.contribution_id, d.decision]));

  const items: FeedItem[] = feed.map((c) => {
    const others = writers.filter((w) => w.user_id !== c.user_id).length;
    return {
      ...c,
      authorShort: shortName(c),
      isMine: c.user_id === user!.userId,
      myDecision: decided.get(c.contribution_id) ?? null,
      canVerify: canWrite && c.verification_status === "pending" && c.user_id !== user!.userId && !decided.has(c.contribution_id),
      confirmsNeeded: Math.floor(others / 2) + 1,
    };
  });

  return {
    team,
    resource,
    canWrite,
    isInstructor: can(user, "team.manage", resource),
    members,
    feed: items,
    tasks: teamTasks,
    myTasks: teamTasks.filter((t) => t.task_status !== "done" && (t.user_id === null || t.user_id === user!.userId)),
  };
}

export interface LogInput {
  description: string;
  hours: string;
  completionDate: string;
  taskId: number | null;
  finishesTask: boolean;
}

export type FieldErrors = Partial<Record<"description" | "hours" | "completionDate" | "taskId", string>>;

/** P09 — log a completed piece of work. Returns field errors for the form instead of throwing. */
export async function logContribution(user: SessionUser | null, teamId: number, input: LogInput): Promise<{ errors?: FieldErrors }> {
  await authorizeTeam(user, "team.write", teamId);
  const errors: FieldErrors = {};
  if (!input.description) errors.description = "Say what you did in a few words.";
  else if (input.description.length > 255) errors.description = "Keep it under 255 characters.";
  const hours = validateHours(input.hours);
  if (hours.error) errors.hours = hours.error;
  if (!isIsoDate(input.completionDate)) errors.completionDate = "Pick the date you finished.";
  // The latest local date anywhere on Earth is UTC+14, so nothing past that can be "today" for anyone.
  else if (input.completionDate > new Date(Date.now() + 14 * 3600 * 1000).toISOString().slice(0, 10)) {
    errors.completionDate = "That date is in the future.";
  }
  if (input.taskId !== null) {
    const task = await tasks.byId(input.taskId);
    if (!task || task.team_id !== teamId) errors.taskId = "Pick one of your team's tasks.";
    // Credit follows the task owner (P13): you can only log against your own or unassigned tasks.
    else if (task.user_id !== null && task.user_id !== user!.userId) errors.taskId = "That task belongs to a teammate now.";
  }
  if (Object.keys(errors).length > 0) return { errors };

  await contributions.create({
    team_id: teamId,
    user_id: user!.userId,
    task_id: input.taskId,
    description: input.description,
    hours_spent: hours.value,
    completion_date: input.completionDate,
  });
  if (input.taskId !== null) {
    await tasks.setStatus(input.taskId, input.finishesTask ? "done" : "in_progress");
  }
  return {};
}

/** P10 — confirm or dispute a teammate's entry. Disputes need a reason and go to the instructor. */
export async function verifyContribution(user: SessionUser | null, contributionId: number, decision: "confirm" | "dispute", reasonRaw: string) {
  const c = await contributions.byId(contributionId);
  if (!c) throw new NotFoundError("That entry doesn't exist.");
  await authorizeTeam(user, "team.write", c.team_id);
  if (c.user_id === user!.userId) throw new UserError("You can't confirm or dispute your own work.");
  if (c.verification_status !== "pending") throw new UserError("This entry has already been settled.");
  const reason = reasonRaw.trim().slice(0, 255);
  const others = (await memberships.byTeam(c.team_id)).filter((m) => m.access_level === "write" && m.user_id !== c.user_id).length;

  try {
    if (decision === "dispute") {
      if (!reason) throw new UserError("Tell your instructor why you're disputing this entry.");
      await contributions.recordDispute(contributionId, user!.userId, reason);
      return;
    }
    await contributions.recordConfirm(contributionId, user!.userId, others);
  } catch (e) {
    if (e instanceof Error && /UNIQUE/i.test(e.message)) throw new UserError("You've already responded to this entry.");
    throw e;
  }
}

// ── Disputes (P11) ───────────────────────────────────────────────────────────

export async function disputeQueue(user: SessionUser | null) {
  authorize(user, "course.create"); // instructors only; the query is scoped to their own courses
  const [open, resolved] = await Promise.all([disputes.queueForInstructor(user.userId, "open"), disputes.queueForInstructor(user.userId, "resolved")]);
  return { open, resolved: resolved.slice(0, 20) };
}

export async function resolveDispute(user: SessionUser | null, disputeId: number, resolution: "upheld" | "rejected", noteRaw: string) {
  const d = await disputes.byId(disputeId);
  if (!d) throw new NotFoundError("That dispute doesn't exist.");
  await authorizeTeam(user, "dispute.resolve", d.team_id);
  if (d.dispute_status !== "open") throw new UserError("This dispute has already been resolved.");
  if (resolution !== "upheld" && resolution !== "rejected") throw new UserError("Choose whether the dispute is upheld or rejected.");
  const note = noteRaw.trim().slice(0, 255);
  if (!note) throw new UserError("Add a short note explaining your decision. The team will see it.");
  await disputes.resolve(disputeId, d.contribution_id, user!.userId, resolution, note, statusAfterDisputeResolution(resolution));
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function addTask(user: SessionUser | null, teamId: number, input: { title: string; ownerId: number | null; dueDate: string }) {
  await authorizeTeam(user, "team.write", teamId);
  if (!input.title || input.title.length > 100) throw new UserError("Give the task a short name (up to 100 characters).");
  if (input.dueDate && !isIsoDate(input.dueDate)) throw new UserError("Pick a valid due date or leave it blank.");
  if (input.ownerId !== null && !(await memberships.forUser(teamId, input.ownerId))) throw new UserError("Pick someone on your team.");
  await tasks.create({ team_id: teamId, user_id: input.ownerId, task_title: input.title, due_date: input.dueDate || null, task_status: "to_do" });
}

export async function setTaskStatus(user: SessionUser | null, taskId: number, status: TaskStatus) {
  const task = await tasks.byId(taskId);
  if (!task) throw new NotFoundError("That task doesn't exist.");
  await authorizeTeam(user, "team.write", task.team_id);
  if (!["to_do", "in_progress", "done"].includes(status)) throw new UserError("Unknown status.");
  await tasks.setStatus(taskId, status);
}
