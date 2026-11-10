import { describe, expect, it } from "vitest";
import {
  detectIntegrityFlags,
  groupRosterByTeam,
  inactiveMembers,
  isCharterComplete,
  nextVerificationStatus,
  parseRosterCsv,
  statusAfterDisputeResolution,
  validateHours,
  type Rating,
} from "@/lib/rules";
import { computeAdjustedGrade, CONTRIBUTION_FORMULA } from "@/config/contribution-formula";

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
  it("is complete only when every member has a role and confirmed it", () => {
    expect(isCharterComplete([])).toBe(false);
    expect(isCharterComplete([{ role_confirmed: 1, team_role: "Lead" }, { role_confirmed: 0, team_role: "Docs" }])).toBe(false);
    expect(isCharterComplete([{ role_confirmed: 1, team_role: "Lead" }, { role_confirmed: 1, team_role: null }])).toBe(false);
    expect(isCharterComplete([{ role_confirmed: 1, team_role: "Lead" }, { role_confirmed: 1, team_role: "Docs" }])).toBe(true);
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

describe("contribution formula", () => {
  it("scales the team grade by member average ÷ team average", () => {
    const r = computeAdjustedGrade({ teamGrade: 90, memberAverage: 4.5, teamAverage: 4.0 });
    expect(r.factor).toBeCloseTo(1.125);
    expect(r.adjustedGrade).toBe(101.3);
    expect(r.capped).toBeNull();
    expect(r.explanation).toBe("90 × (4.50 ÷ 4.00) = 101.3");
  });

  it("caps at the configured maximum", () => {
    const r = computeAdjustedGrade({ teamGrade: 100, memberAverage: 5, teamAverage: 3 });
    expect(r.adjustedGrade).toBe(CONTRIBUTION_FORMULA.MAX_PERCENT);
    expect(r.capped).toBe("high");
  });

  it("keeps the team grade when there are no ratings", () => {
    const r = computeAdjustedGrade({ teamGrade: 88, memberAverage: null, teamAverage: 4 });
    expect(r.adjustedGrade).toBe(88);
    expect(r.factor).toBe(1);
  });

  it("lowers the grade of a low-rated member", () => {
    const r = computeAdjustedGrade({ teamGrade: 90, memberAverage: 2, teamAverage: 4 });
    expect(r.adjustedGrade).toBe(45);
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
