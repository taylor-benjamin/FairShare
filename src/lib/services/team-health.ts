// Team Health Service — charter (P14), reassignments (P13), early-warning dashboard (Epic 3), public channels (P17).
import "server-only";
import { EARLY_WARNING } from "@/config/integrity-rules";
import { authorize, can } from "../permissions";
import { charters, contributions, disputes, flags, memberships, projects, tasks, teams } from "../data/repo";
import { inactiveMembers, isCharterComplete } from "../rules";
import type { SessionUser } from "../types";
import { authorizeTeam, fullName, NotFoundError, UserError } from "./common";

// ── Team charter (P14) ───────────────────────────────────────────────────────

export async function getCharter(user: SessionUser | null, teamId: number) {
  const { team, resource } = await authorizeTeam(user, "team.read", teamId);
  const [charter, members] = await Promise.all([charters.byTeam(teamId), memberships.byTeam(teamId)]);
  return { team, charter, members, complete: !!charter?.completed_date, canWrite: can(user, "team.write", resource) };
}

async function refreshCharterCompletion(teamId: number) {
  const members = await memberships.byTeam(teamId);
  const charter = await charters.byTeam(teamId);
  if (charter) await charters.setCompleted(teamId, isCharterComplete(members));
}

export async function saveCharter(user: SessionUser | null, teamId: number, input: { goals: string; expectations: string; roles: Record<number, string> }) {
  await authorizeTeam(user, "team.write", teamId);
  if (!input.goals) throw new UserError("Write at least one team goal.");
  if (!input.expectations) throw new UserError("Write down how you'll communicate and hit deadlines.");
  if (input.goals.length > 2000 || input.expectations.length > 2000) throw new UserError("Keep goals and expectations under 2,000 characters each.");

  await charters.upsert(teamId, input.goals, input.expectations);
  const members = await memberships.byTeam(teamId);
  for (const m of members) {
    const role = (input.roles[m.user_id] ?? "").trim().slice(0, 50);
    if (role && role !== m.team_role) await memberships.setRole(teamId, m.user_id, role); // a changed role must be re-confirmed
  }
  await refreshCharterCompletion(teamId);
}

export async function confirmMyRole(user: SessionUser | null, teamId: number) {
  await authorizeTeam(user, "team.write", teamId);
  const me = await memberships.forUser(teamId, user!.userId);
  if (!me?.team_role) throw new UserError("Your team hasn't given you a role yet. Add it in the charter first.");
  if (!(await charters.byTeam(teamId))) throw new UserError("Save the charter's goals and expectations first.");
  await memberships.confirmRole(teamId, user!.userId);
  await refreshCharterCompletion(teamId);
}

// ── Task reassignment (P13) ──────────────────────────────────────────────────

export async function reassignTask(user: SessionUser | null, taskId: number, toUserId: number, reasonRaw: string) {
  const task = await tasks.byId(taskId);
  if (!task) throw new NotFoundError("That task doesn't exist.");
  await authorizeTeam(user, "task.reassign", task.team_id);
  if (task.user_id === null) throw new UserError("This task has no owner yet, so there's nothing to reassign.");
  if (task.user_id === toUserId) throw new UserError("Pick a different teammate to take over the task.");
  if (!(await memberships.forUser(task.team_id, toUserId))) throw new UserError("Pick someone on this team.");
  const reason = reasonRaw.trim().slice(0, 255);
  if (!reason) throw new UserError("Add a short reason, for example “agreed in office hours on Oct 14”.");
  await tasks.reassign(taskId, task.user_id, toUserId, user!.userId, reason);
}

export async function getReassignments(user: SessionUser | null, teamId: number) {
  await authorizeTeam(user, "team.read", teamId);
  return tasks.reassignmentsByTeam(teamId);
}

// ── Instructor dashboard: "Needs your review" signals ────────────────────────

export interface TeamSignal {
  teamId: number;
  teamName: string;
  channelStatus: string;
  visibility: string;
  memberCount: number;
  openDisputes: number;
  openFlags: number;
  inactive: { userId: number; name: string; lastLoggedDate: string | null }[];
  needsAttention: boolean;
  headline: string;
  reasons: string[];
}

export async function teamSignals(user: SessionUser | null, projectId: number, at: Date = new Date()): Promise<TeamSignal[]> {
  const project = await projects.byId(projectId);
  if (!project) throw new NotFoundError();
  authorize(user, "course.manage", { kind: "course", instructorId: project.instructor_id });

  const teamRows = await teams.byProject(projectId);
  return Promise.all(
    teamRows.map(async (t) => {
      const [members, last, d, f] = await Promise.all([
        memberships.byTeam(t.team_id),
        contributions.lastLoggedByMember(t.team_id),
        disputes.openCountByTeam(t.team_id),
        flags.openCountByTeam(t.team_id),
      ]);
      const lastById = new Map(last.map((l) => [l.user_id, l.last_logged]));
      // Only nag about inactivity while the channel is live and the member has been on the team for the whole window.
      const live = t.channel_status === "published";
      const inactive = live
        ? inactiveMembers(
            members.map((m) => ({ userId: m.user_id, name: fullName(m), lastLoggedDate: lastById.get(m.user_id) ?? null })),
            at,
          ).filter((m) => {
            const joined = members.find((x) => x.user_id === m.userId)?.joined_date;
            return !joined || at.getTime() - new Date(joined).getTime() > EARLY_WARNING.INACTIVE_DAYS * 24 * 3600 * 1000;
          })
        : [];
      const openDisputes = d?.n ?? 0;
      const openFlags = f?.n ?? 0;
      const reasons: string[] = [];
      for (const m of inactive) reasons.push(`${m.name} hasn't logged any work in 3 weeks.`);
      if (openDisputes) reasons.push(`${openDisputes} logged ${openDisputes === 1 ? "task is" : "tasks are"} disputed by a teammate.`);
      if (openFlags) reasons.push(`${openFlags} peer ${openFlags === 1 ? "rating looks" : "ratings look"} unusual.`);
      const needsAttention = reasons.length > 0;
      return {
        teamId: t.team_id,
        teamName: t.team_name,
        channelStatus: t.channel_status,
        visibility: t.visibility,
        memberCount: members.length,
        openDisputes,
        openFlags,
        inactive,
        needsAttention,
        headline: needsAttention ? `${t.team_name} in Section ${project.section_number} may need attention` : `${t.team_name} is on track`,
        reasons,
      };
    }),
  );
}

// ── Student and viewer navigation, public channels (P17) ─────────────────────

/** What the team channel header and tabs need; also the read check for every team page. */
export async function teamHeader(user: SessionUser | null, teamId: number) {
  const { team, resource } = await authorizeTeam(user, "team.read", teamId);
  const member = resource.membership !== null && user!.role === "student";
  return {
    team,
    tabs: {
      tasks: member || can(user, "team.manage", resource),
      charter: member || can(user, "team.manage", resource),
      ratings: can(user, "evaluation.submit", resource),
      feedback: can(user, "evaluation.readOwn", resource),
      instructor: can(user, "team.manage", resource),
    },
    readOnlyReason:
      team.visibility === "public"
        ? "This channel is public and read-only. Evaluations are never shown here."
        : team.channel_status === "finished"
          ? "This channel is finished. You can read it, but new work can't be logged."
          : !can(user, "team.write", resource) && member
            ? "You have read-only access to this channel."
            : null,
  };
}

export async function myTeams(user: SessionUser | null) {
  if (!user || user.role !== "student") return [];
  return teams.forStudent(user.userId);
}

export async function publicChannels(user: SessionUser | null) {
  authorize(user, "publicChannels.list");
  return teams.publicChannels();
}

export async function makeChannelPublic(user: SessionUser | null, teamId: number) {
  const { team } = await authorizeTeam(user, "team.makePublic", teamId);
  if (team.visibility === "public") return;
  await teams.makePublic(teamId);
}
