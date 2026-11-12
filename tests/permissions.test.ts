import { describe, expect, it } from "vitest";
import { authorize, can, PermissionError, type TeamResource } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";

const linda: SessionUser = { userId: 1, firstName: "Linda", lastName: "Harris", email: "l@x.edu", role: "instructor" };
const otherProf: SessionUser = { userId: 2, firstName: "Other", lastName: "Prof", email: "o@x.edu", role: "instructor" };
const marcus: SessionUser = { userId: 10, firstName: "Marcus", lastName: "Reed", email: "m@x.edu", role: "student" };

function team(overrides: Partial<TeamResource> = {}): TeamResource {
  return { kind: "team", teamId: 7, instructorId: linda.userId, channelStatus: "published", membership: null, ...overrides };
}
const asMember = (accessLevel: "read" | "write" = "write", o: Partial<TeamResource> = {}) => team({ membership: { accessLevel }, ...o });

describe("anonymous (signed out)", () => {
  it("is denied everything", () => {
    expect(can(null, "team.read", team({ channelStatus: "finished" }))).toBe(false);
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

  it("can read their own teams, including drafts and finished ones, but not another instructor's", () => {
    expect(can(linda, "team.read", team({ channelStatus: "draft" }))).toBe(true);
    expect(can(linda, "team.read", team({ channelStatus: "finished" }))).toBe(true);
    expect(can(otherProf, "team.read", team())).toBe(false);
    expect(can(otherProf, "team.read", team({ channelStatus: "finished" }))).toBe(false);
  });

  it("does not log work or submit ratings in a team channel", () => {
    expect(can(linda, "team.write", team())).toBe(false);
    expect(can(linda, "evaluation.submit", team())).toBe(false);
  });

  it("can delete only their own projects and teams", () => {
    for (const action of ["project.delete", "team.delete"] as const) {
      expect(can(linda, action, team({ channelStatus: "finished" }))).toBe(true);
      expect(can(otherProf, action, team({ channelStatus: "finished" }))).toBe(false);
    }
    expect(can(linda, "project.delete", { kind: "course", instructorId: 1 })).toBe(true);
    expect(can(otherProf, "project.delete", { kind: "course", instructorId: 1 })).toBe(false);
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

  it("cannot read or write a team they don't belong to, finished or not", () => {
    expect(can(marcus, "team.read", team())).toBe(false);
    expect(can(marcus, "team.write", team())).toBe(false);
    expect(can(marcus, "team.read", team({ channelStatus: "finished" }))).toBe(false);
  });

  it("cannot read a draft channel even if listed as a member", () => {
    expect(can(marcus, "team.read", asMember("write", { channelStatus: "draft" }))).toBe(false);
  });

  it("can read but not write their own finished team, and can still give final ratings", () => {
    const finished = asMember("write", { channelStatus: "finished" });
    expect(can(marcus, "team.read", finished)).toBe(true);
    expect(can(marcus, "team.write", finished)).toBe(false);
    expect(can(marcus, "evaluation.submit", finished)).toBe(true);
  });

  it("can never delete projects or teams, even their own", () => {
    for (const action of ["project.delete", "team.delete"] as const) expect(can(marcus, action, asMember())).toBe(false);
  });

  it("sees only their own received ratings, never everyone's", () => {
    expect(can(marcus, "evaluation.readOwn", asMember())).toBe(true);
    expect(can(marcus, "evaluation.readAll", asMember())).toBe(false);
    expect(can(marcus, "evaluation.readOwn", team())).toBe(false);
  });
});

describe("authorize()", () => {
  it("throws PermissionError when denied and returns quietly when allowed", () => {
    expect(() => authorize(marcus, "team.write", team())).toThrow(PermissionError);
    expect(() => authorize(marcus, "team.write", asMember())).not.toThrow();
  });
});
