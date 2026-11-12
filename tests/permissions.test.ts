import { describe, expect, it } from "vitest";
import { authorize, can, PermissionError, type TeamResource } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";

const linda: SessionUser = { userId: 1, firstName: "Linda", lastName: "Harris", email: "l@x.edu", role: "instructor" };
const otherProf: SessionUser = { userId: 2, firstName: "Other", lastName: "Prof", email: "o@x.edu", role: "instructor" };
const marcus: SessionUser = { userId: 10, firstName: "Marcus", lastName: "Reed", email: "m@x.edu", role: "student" };
const viewer: SessionUser = { userId: 50, firstName: "Vic", lastName: "Viewer", email: "v@x.edu", role: "viewer" };

function team(overrides: Partial<TeamResource> = {}): TeamResource {
  return { kind: "team", teamId: 7, instructorId: linda.userId, channelStatus: "published", visibility: "private", membership: null, ...overrides };
}
const asMember = (accessLevel: "read" | "write" = "write", o: Partial<TeamResource> = {}) => team({ membership: { accessLevel }, ...o });

describe("anonymous (signed out)", () => {
  it("is denied everything", () => {
    expect(can(null, "team.read", team({ visibility: "public", channelStatus: "finished" }))).toBe(false);
    expect(can(null, "publicChannels.list")).toBe(false);
    expect(can(null, "course.create")).toBe(false);
  });
});

describe("instructor", () => {
  it("can create courses", () => expect(can(linda, "course.create")).toBe(true));

  it("controls only their own courses and teams", () => {
    for (const action of ["course.manage", "team.manage", "dispute.resolve", "flag.review", "task.reassign", "evaluation.readAll"] as const) {
      expect(can(linda, action, team())).toBe(true);
      expect(can(otherProf, action, team())).toBe(false);
    }
    expect(can(linda, "course.manage", { kind: "course", instructorId: 1 })).toBe(true);
    expect(can(otherProf, "course.manage", { kind: "course", instructorId: 1 })).toBe(false);
  });

  it("can read their own teams, including drafts, but not another instructor's private team", () => {
    expect(can(linda, "team.read", team({ channelStatus: "draft" }))).toBe(true);
    expect(can(otherProf, "team.read", team())).toBe(false);
  });

  it("does not log work or submit ratings in a team channel", () => {
    expect(can(linda, "team.write", team())).toBe(false);
    expect(can(linda, "evaluation.submit", team())).toBe(false);
  });

  it("can delete only their own projects and teams, and unpublish their own public channels", () => {
    const publicTeam = team({ channelStatus: "finished", visibility: "public" });
    for (const action of ["project.delete", "team.delete", "team.unpublish"] as const) {
      expect(can(linda, action, publicTeam)).toBe(true);
      expect(can(otherProf, action, publicTeam)).toBe(false);
    }
    expect(can(linda, "project.delete", { kind: "course", instructorId: 1 })).toBe(true);
    expect(can(otherProf, "project.delete", { kind: "course", instructorId: 1 })).toBe(false);
  });

  it("can make a finished channel public, but not an unfinished one", () => {
    expect(can(linda, "team.makePublic", team({ channelStatus: "finished" }))).toBe(true);
    expect(can(linda, "team.makePublic", team({ channelStatus: "published" }))).toBe(false);
    expect(can(otherProf, "team.makePublic", team({ channelStatus: "finished" }))).toBe(false);
  });
});

describe("student", () => {
  it("cannot create courses or manage anything", () => {
    expect(can(marcus, "course.create")).toBe(false);
    for (const action of ["course.manage", "team.manage", "dispute.resolve", "flag.review", "task.reassign", "evaluation.readAll"] as const) {
      expect(can(marcus, action, asMember())).toBe(false);
    }
  });

  it("reads and writes a published team they belong to with write access", () => {
    expect(can(marcus, "team.read", asMember())).toBe(true);
    expect(can(marcus, "team.write", asMember())).toBe(true);
    expect(can(marcus, "evaluation.submit", asMember())).toBe(true);
  });

  it("can read but not write with read-only access", () => {
    expect(can(marcus, "team.read", asMember("read"))).toBe(true);
    expect(can(marcus, "team.write", asMember("read"))).toBe(false);
    expect(can(marcus, "evaluation.submit", asMember("read"))).toBe(false);
  });

  it("cannot read or write a private team they don't belong to", () => {
    expect(can(marcus, "team.read", team())).toBe(false);
    expect(can(marcus, "team.write", team())).toBe(false);
  });

  it("cannot read a draft channel even if listed as a member", () => {
    expect(can(marcus, "team.read", asMember("write", { channelStatus: "draft" }))).toBe(false);
  });

  it("can read another team's public channel but never write to it", () => {
    const publicTeam = team({ channelStatus: "finished", visibility: "public" });
    expect(can(marcus, "team.read", publicTeam)).toBe(true);
    expect(can(marcus, "team.write", publicTeam)).toBe(false);
  });

  it("cannot write to their own team once it is public or finished", () => {
    expect(can(marcus, "team.write", asMember("write", { channelStatus: "finished", visibility: "public" }))).toBe(false);
    expect(can(marcus, "team.write", asMember("write", { channelStatus: "finished" }))).toBe(false);
    expect(can(marcus, "evaluation.submit", asMember("write", { channelStatus: "finished", visibility: "public" }))).toBe(false);
  });

  it("can never delete projects or teams, or unpublish a channel — even their own", () => {
    const own = asMember("write", { channelStatus: "finished", visibility: "public" });
    for (const action of ["project.delete", "team.delete", "team.unpublish"] as const) expect(can(marcus, action, own)).toBe(false);
  });

  it("can make their own finished channel public, not another team's", () => {
    expect(can(marcus, "team.makePublic", asMember("write", { channelStatus: "finished" }))).toBe(true);
    expect(can(marcus, "team.makePublic", team({ channelStatus: "finished" }))).toBe(false);
  });

  it("sees only their own received ratings, never everyone's", () => {
    expect(can(marcus, "evaluation.readOwn", asMember())).toBe(true);
    expect(can(marcus, "evaluation.readAll", asMember())).toBe(false);
    expect(can(marcus, "evaluation.readOwn", team())).toBe(false);
  });
});

describe("viewer", () => {
  it("can list and read public channels only", () => {
    expect(can(viewer, "publicChannels.list")).toBe(true);
    expect(can(viewer, "team.read", team({ channelStatus: "finished", visibility: "public" }))).toBe(true);
    expect(can(viewer, "team.read", team())).toBe(false);
  });

  it("can never write, rate, or see evaluations — even on a public channel", () => {
    const publicTeam = team({ channelStatus: "finished", visibility: "public" });
    for (const action of ["team.write", "evaluation.submit", "evaluation.readAll", "evaluation.readOwn", "team.makePublic", "course.create", "team.delete", "team.unpublish", "project.delete"] as const) {
      expect(can(viewer, action, publicTeam)).toBe(false);
    }
  });

  it("is denied even if a membership row somehow exists", () => {
    expect(can(viewer, "team.write", asMember())).toBe(false);
    expect(can(viewer, "team.read", asMember())).toBe(false);
  });
});

describe("authorize()", () => {
  it("throws PermissionError when denied and returns quietly when allowed", () => {
    expect(() => authorize(viewer, "team.write", asMember())).toThrow(PermissionError);
    expect(() => authorize(marcus, "team.write", asMember())).not.toThrow();
  });
});
