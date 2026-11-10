// P04 — the single permission check. Every service calls authorize() (which calls can())
// before it reads or writes anything. can() is pure so it can be unit-tested for every role.

import type { AccessLevel, ChannelStatus, SessionUser, Visibility } from "./types";

export type Action =
  // Instructor-only setup and oversight
  | "course.create"
  | "course.manage" // view/edit a course, its projects, milestones, teams
  | "team.manage" // publish, finish, change settings of a team channel
  | "dispute.resolve"
  | "flag.review"
  | "task.reassign"
  | "evaluation.readAll" // see every rating with evaluator names
  // Team channel
  | "team.read" // see the activity feed, members, charter
  | "team.write" // log work, confirm/dispute, edit charter, add tasks
  | "team.makePublic"
  | "evaluation.submit"
  | "evaluation.readOwn" // a student's own received ratings (names hidden if anonymous)
  // Directory
  | "publicChannels.list";

/** Facts about a team the permission check needs. Loaded by the data layer, never trusted from the client. */
export interface TeamResource {
  kind: "team";
  teamId: number;
  instructorId: number; // owner of the course the team belongs to
  channelStatus: ChannelStatus;
  visibility: Visibility;
  /** The acting user's membership in this team, or null if they are not a member. */
  membership: { accessLevel: AccessLevel } | null;
}

export interface CourseResource {
  kind: "course";
  instructorId: number;
}

export interface NoResource {
  kind: "none";
}

export type Resource = TeamResource | CourseResource | NoResource;

export class PermissionError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "PermissionError";
  }
}

function ownsResource(user: SessionUser, resource: Resource): boolean {
  if (user.role !== "instructor") return false;
  if (resource.kind === "team" || resource.kind === "course") {
    return resource.instructorId === user.userId;
  }
  return false;
}

function isStudentMember(user: SessionUser, resource: Resource): resource is TeamResource {
  return user.role === "student" && resource.kind === "team" && resource.membership !== null;
}

function canWriteTeam(user: SessionUser, resource: Resource): boolean {
  return (
    isStudentMember(user, resource) &&
    resource.membership!.accessLevel === "write" &&
    resource.visibility === "private" && // public channels are read-only for everyone
    resource.channelStatus === "published" // draft channels have no members yet; finished ones are closed
  );
}

/** The one rule book. Returns true only when the action is allowed; anything not listed is denied. */
export function can(user: SessionUser | null, action: Action, resource: Resource = { kind: "none" }): boolean {
  if (!user) return false;

  switch (action) {
    case "course.create":
      return user.role === "instructor";

    case "course.manage":
    case "team.manage":
    case "dispute.resolve":
    case "flag.review":
    case "task.reassign":
    case "evaluation.readAll":
      return ownsResource(user, resource);

    case "team.read":
      if (resource.kind !== "team") return false;
      if (ownsResource(user, resource)) return true;
      if (resource.visibility === "public") return true; // any signed-in account, including viewers
      return isStudentMember(user, resource) && resource.channelStatus !== "draft";

    case "team.write":
      return canWriteTeam(user, resource);

    case "evaluation.submit":
      // Ratings are part of working in the channel; a finished-but-private channel may still collect final ratings.
      return (
        isStudentMember(user, resource) &&
        resource.membership!.accessLevel === "write" &&
        resource.visibility === "private" &&
        resource.channelStatus !== "draft"
      );

    case "evaluation.readOwn":
      return isStudentMember(user, resource);

    case "team.makePublic":
      if (resource.kind !== "team" || resource.channelStatus !== "finished") return false;
      return ownsResource(user, resource) || isStudentMember(user, resource);

    case "publicChannels.list":
      return true; // any signed-in account

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

/** Throws PermissionError unless can() allows the action. Services call this first. */
export function authorize(user: SessionUser | null, action: Action, resource: Resource = { kind: "none" }): asserts user is SessionUser {
  if (!can(user, action, resource)) {
    throw new PermissionError();
  }
}
