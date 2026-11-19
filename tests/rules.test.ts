import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  daysUntil,
  dueLabel,
  detectIntegrityFlags,
  groupRosterByTeam,
  inactiveMembers,
  allAgreed,
  canAnswerDeleteRequest,
  charterStatus,
  isCharterComplete,
  nextSetupStep,
  nextVerificationStatus,
  parseRosterCsv,
  statusAfterDisputeResolution,
  taskDeleteMode,
  validateHours,
  type Rating,
} from "@/lib/rules";

describe("claim-and-verify status", () => {
  it("stays pending until a majority of the other members confirm", () => {
    // Team of 4 → 3 other members → need 2 confirms.
    expect(nextVerificationStatus(3, [])).toBe("pending");
    expect(nextVerificationStatus(3, ["confirm"])).toBe("pending");
    expect(nextVerificationStatus(3, ["confirm", "confirm"])).toBe("confirmed");
  });

  it("needs a strict majority (2 of 2 others in a team of 3; 1 of 1 in a pair)", () => {
    expect(nextVerificationStatus(2, ["confirm"])).toBe("pending");
    expect(nextVerificationStatus(2, ["confirm", "confirm"])).toBe("confirmed");
    expect(nextVerificationStatus(1, ["confirm"])).toBe("confirmed");
  });

  it("becomes disputed on any dispute, even after confirms", () => {
    expect(nextVerificationStatus(3, ["dispute"])).toBe("disputed");
    expect(nextVerificationStatus(3, ["confirm", "confirm", "dispute"])).toBe("disputed");
  });

  it("resolves disputes: upheld keeps it disputed, rejected confirms it", () => {
    expect(statusAfterDisputeResolution("upheld")).toBe("disputed");
    expect(statusAfterDisputeResolution("rejected")).toBe("confirmed");
  });
});

describe("team charter", () => {
  const m = (role_confirmed: number, team_role: string | null, charter_agreed = 1) => ({ role_confirmed, team_role, charter_agreed });
  it("is complete only when every member has set a role and agreed", () => {
    expect(isCharterComplete([])).toBe(false);
    expect(isCharterComplete([m(1, "Lead"), m(0, "Docs")])).toBe(false);
    expect(isCharterComplete([m(1, "Lead"), m(1, null)])).toBe(false);
    expect(isCharterComplete([m(1, "Lead"), m(1, "Docs", 0)])).toBe(false);
    expect(isCharterComplete([m(1, "Lead"), m(1, "Docs")])).toBe(true);
  });

  it("locks only when everyone has agreed", () => {
    expect(allAgreed([])).toBe(false);
    expect(allAgreed([m(1, "Lead"), m(1, "Docs", 0)])).toBe(false);
    expect(allAgreed([m(0, null), m(1, "Docs")])).toBe(true);
  });

  it("sums up its status for the team banner", () => {
    expect(charterStatus(false, [m(1, "Lead")])).toEqual({ label: "Not started", done: false });
    expect(charterStatus(true, [m(1, "Lead"), m(1, "Docs", 0), m(0, null, 0)]).label).toBe("1 of 3 agreed");
    expect(charterStatus(true, [m(1, "Lead"), m(0, null)]).label).toBe("1 of 2 roles set");
    expect(charterStatus(true, [m(1, "Lead"), m(1, "Docs")])).toEqual({ label: "Complete", done: true });
  });
});

describe("integrity flags", () => {
  const members = [1, 2, 3, 4];
  const names = { 1: "Marcus", 2: "Priya", 3: "Devon", 4: "Aaliyah" };

  it("flags a rater who gave every teammate the same score", () => {
    const ratings: Rating[] = [
      { evaluatorId: 3, evaluateeId: 1, score: 5 },
      { evaluatorId: 3, evaluateeId: 2, score: 5 },
      { evaluatorId: 3, evaluateeId: 4, score: 5 },
      { evaluatorId: 1, evaluateeId: 2, score: 4 },
      { evaluatorId: 1, evaluateeId: 3, score: 2 },
      { evaluatorId: 1, evaluateeId: 4, score: 4 },
    ];
    const flags = detectIntegrityFlags(ratings, members, names);
    expect(flags).toEqual([{ raterId: 3, type: "identical_scores", details: "Devon gave all 3 teammates a 5." }]);
  });

  it("does not flag identical scores until the rater has rated everyone", () => {
    const ratings: Rating[] = [
      { evaluatorId: 3, evaluateeId: 1, score: 5 },
      { evaluatorId: 3, evaluateeId: 2, score: 5 },
    ];
    expect(detectIntegrityFlags(ratings, members, names)).toEqual([]);
  });

  it("flags two members who rate each other well above the team average", () => {
    const ratings: Rating[] = [
      { evaluatorId: 1, evaluateeId: 2, score: 5 },
      { evaluatorId: 2, evaluateeId: 1, score: 5 },
      { evaluatorId: 1, evaluateeId: 3, score: 2 },
      { evaluatorId: 1, evaluateeId: 4, score: 2 },
      { evaluatorId: 2, evaluateeId: 3, score: 2 },
      { evaluatorId: 2, evaluateeId: 4, score: 1 },
      { evaluatorId: 3, evaluateeId: 1, score: 3 },
      { evaluatorId: 4, evaluateeId: 2, score: 3 },
    ];
    const flags = detectIntegrityFlags(ratings, members, names).filter((f) => f.type === "reciprocal_scores");
    expect(flags.map((f) => f.raterId).sort()).toEqual([1, 2]);
  });

  it("does not flag mutual high scores when the whole team rates high", () => {
    const ratings: Rating[] = [];
    for (const a of members) for (const b of members) if (a !== b) ratings.push({ evaluatorId: a, evaluateeId: b, score: a === b ? 0 : 4 + ((a + b) % 2) });
    const flags = detectIntegrityFlags(ratings, members, names).filter((f) => f.type === "reciprocal_scores");
    expect(flags).toEqual([]);
  });
});

describe("early warning", () => {
  it("lists members with no work logged in the last 21 days", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    const result = inactiveMembers(
      [
        { userId: 1, name: "Marcus", lastLoggedDate: "2026-11-08T10:00:00Z" },
        { userId: 3, name: "Devon", lastLoggedDate: "2026-10-01T10:00:00Z" },
        { userId: 5, name: "New", lastLoggedDate: null },
      ],
      now,
    );
    expect(result.map((m) => m.name)).toEqual(["Devon", "New"]);
  });
});

describe("roster CSV", () => {
  it("parses a valid file, lowercases emails, and groups by team", () => {
    const csv = "first_name,last_name,email,team_name\nMarcus,Reed,MARCUS@x.edu,Team Tigers\nPriya,Shah,priya@x.edu,Team Tigers\n";
    const { rows, errors } = parseRosterCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0].email).toBe("marcus@x.edu");
    expect([...groupRosterByTeam(rows).keys()]).toEqual(["Team Tigers"]);
  });

  it("handles quoted fields and a byte-order mark", () => {
    const csv = '﻿first_name,last_name,email,team_name\n"Ann","Lee, Jr.",a@x.edu,T1\nBo,Kim,b@x.edu,T1';
    const { rows, errors } = parseRosterCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0].last_name).toBe("Lee, Jr.");
  });

  it("explains missing columns in plain language", () => {
    const { errors } = parseRosterCsv("name,email\nA,a@x.edu");
    expect(errors[0]).toMatch(/couldn't find: first_name, last_name, team_name/);
  });

  it("reports bad rows by row number", () => {
    const csv = "first_name,last_name,email,team_name\nA,B,not-an-email,T1\n,C,c@x.edu,T1\nD,E,d@x.edu,T1\nF,G,d@x.edu,T1";
    const { errors } = parseRosterCsv(csv);
    expect(errors).toContain('Row 2: "not-an-email" doesn\'t look like an email address.');
    expect(errors).toContain("Row 3: first name is blank.");
    expect(errors).toContain("Row 5: d@x.edu is already listed on row 4.");
  });

  it("rejects single-person teams", () => {
    const { errors } = parseRosterCsv("first_name,last_name,email,team_name\nA,B,a@x.edu,Solo");
    expect(errors[0]).toMatch(/Solo has only one student/);
  });

  it("rejects an empty file", () => {
    expect(parseRosterCsv("").errors[0]).toMatch(/empty/);
  });
});

describe("hours validation", () => {
  it("accepts 0.5–24 and blanks", () => {
    expect(validateHours("2.5").value).toBe(2.5);
    expect(validateHours("").value).toBeNull();
    expect(validateHours("30").error).toBe("Enter a number from 0.5 to 24.");
    expect(validateHours("abc").error).toBeDefined();
  });
});

describe("instructor next step", () => {
  const ms = (status: string, due: string, id = 1) => ({ milestone_id: id, milestone_name: `M${id}`, milestone_status: status, due_date: due });
  const base = { teamCount: 3, draftCount: 0, pendingInvites: 0, milestones: [ms("completed", "2026-10-01")], today: "2026-11-17" };

  it("walks through setup in order", () => {
    expect(nextSetupStep({ ...base, teamCount: 0 })?.kind).toBe("upload");
    expect(nextSetupStep({ ...base, draftCount: 2 })?.kind).toBe("publish");
    expect(nextSetupStep({ ...base, milestones: [] })?.kind).toBe("add-milestone");
  });

  it("asks to complete the earliest milestone that is due", () => {
    const step = nextSetupStep({ ...base, milestones: [ms("open", "2026-11-20", 3), ms("open", "2026-11-10", 2)] });
    expect(step).toEqual({ kind: "complete-milestone", title: "M2 is due. Mark it complete to open peer ratings.", milestoneId: 2 });
  });

  it("then nudges about unused invites, then nothing", () => {
    expect(nextSetupStep({ ...base, pendingInvites: 1, pendingTeamId: 7 })).toEqual({ kind: "invites", title: "1 student hasn't joined yet. Send them their link.", teamId: 7 });
    expect(nextSetupStep(base)).toBeNull();
  });
});

describe("deleting tasks", () => {
  const MARCUS = 10, PRIYA = 11, DEVON = 12;
  const task = (o: Partial<Parameters<typeof taskDeleteMode>[0]> = {}) => ({ user_id: MARCUS, delete_requested_by_id: null, has_work: false, ...o });

  it("lets the owner delete straight away, including a task reassigned to them", () => {
    expect(taskDeleteMode(task(), MARCUS)).toBe("delete");
    expect(taskDeleteMode(task({ user_id: PRIYA }), PRIYA)).toBe("delete");
  });

  it("lets anyone delete an unassigned task, since there's no owner to ask", () => {
    expect(taskDeleteMode(task({ user_id: null }), DEVON)).toBe("delete");
  });

  it("makes any other teammate ask the owner", () => {
    expect(taskDeleteMode(task({ user_id: PRIYA }), MARCUS)).toBe("request");
    expect(taskDeleteMode(task({ user_id: PRIYA }), DEVON)).toBe("request");
  });

  it("never allows deleting a task with logged work, not even by the owner", () => {
    expect(taskDeleteMode(task({ has_work: true }), MARCUS)).toBeNull();
    expect(taskDeleteMode(task({ has_work: true, user_id: null }), MARCUS)).toBeNull();
    expect(taskDeleteMode(task({ has_work: true, user_id: PRIYA }), MARCUS)).toBeNull();
  });

  it("lets only the current owner answer a pending request", () => {
    const pending = task({ user_id: PRIYA, delete_requested_by_id: MARCUS });
    expect(canAnswerDeleteRequest(pending, PRIYA)).toBe(true);
    expect(canAnswerDeleteRequest(pending, MARCUS)).toBe(false);
    expect(canAnswerDeleteRequest(pending, DEVON)).toBe(false);
    expect(canAnswerDeleteRequest({ ...pending, delete_requested_by_id: null }, PRIYA)).toBe(false);
    expect(canAnswerDeleteRequest({ ...pending, has_work: true }, PRIYA)).toBe(false);
  });
});

describe("due dates for notifications", () => {
  it("adds days across month and year ends", () => {
    expect(addDaysIso("2026-11-28", 7)).toBe("2026-12-05");
    expect(addDaysIso("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDaysIso("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("counts whole days, negative when overdue", () => {
    expect(daysUntil("2026-11-19", "2026-11-19")).toBe(0);
    expect(daysUntil("2026-11-22", "2026-11-19")).toBe(3);
    expect(daysUntil("2026-11-17", "2026-11-19")).toBe(-2);
    expect(daysUntil("2026-11-20T00:00:00Z", "2026-11-19")).toBe(1);
  });
  it("labels the due date", () => {
    expect(dueLabel("2026-11-18", "2026-11-19")).toBe("Overdue by 1 day");
    expect(dueLabel("2026-11-16", "2026-11-19")).toBe("Overdue by 3 days");
    expect(dueLabel("2026-11-19", "2026-11-19")).toBe("Due today");
    expect(dueLabel("2026-11-20", "2026-11-19")).toBe("Due tomorrow");
    expect(dueLabel("2026-11-26", "2026-11-19")).toBe("Due in 7 days");
  });
});
