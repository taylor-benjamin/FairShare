import "server-only";
import { authorize, type Action, type TeamResource } from "../permissions";
import { memberships, teams, type TeamContextRow } from "../data/repo";
import type { SessionUser } from "../types";

/** A problem the user can fix (bad input, wrong state). Message is shown as-is, so keep it plain. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "We couldn't find that.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Builds the TeamResource from the database (never from the client) so the permission check sees the truth. */
export async function loadTeam(user: SessionUser | null, teamId: number): Promise<{ team: TeamContextRow; resource: TeamResource }> {
  const team = Number.isInteger(teamId) ? await teams.context(teamId) : null;
  if (!team) throw new NotFoundError("That team channel doesn't exist.");
  const membership = user ? await memberships.forUser(teamId, user.userId) : null;
  return {
    team,
    resource: {
      kind: "team",
      teamId: team.team_id,
      instructorId: team.instructor_id,
      channelStatus: team.channel_status,
      membership: membership ? { accessLevel: membership.access_level } : null,
    },
  };
}

/** Load a team and pass it through the single permission check in one step. */
export async function authorizeTeam(user: SessionUser | null, action: Action, teamId: number) {
  const loaded = await loadTeam(user, teamId);
  authorize(user, action, loaded.resource);
  return { ...loaded, user };
}

export function cleanText(raw: FormDataEntryValue | null | undefined, max: number): string {
  return String(raw ?? "").trim().slice(0, max);
}

export function fullName(u: { first_name: string; last_name: string }): string {
  return `${u.first_name} ${u.last_name}`;
}

export function shortName(u: { first_name: string; last_name: string }): string {
  return `${u.first_name} ${u.last_name.charAt(0)}.`;
}
