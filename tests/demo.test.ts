import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_PLACEHOLDER_ROSTER as ROSTER, type DemoRoster } from "@/config/demo-class";
import { buildDemoClass, demoHomeEmail, demoLoginRole, displayEmail, parseDemoRoster, scopeEmail, workspaceEmail, workspaceOf } from "@/lib/demo";

const NOW = Date.UTC(2026, 10, 22, 12);
const table = (data: ReturnType<typeof buildDemoClass>, name: string) => data.find((t) => t.table === name)!.rows;
const studentCount = ROSTER.teams.flatMap((t) => t.members).length;
const edited = (change: (r: DemoRoster) => void) => {
  const r = structuredClone(ROSTER);
  change(r);
  return JSON.stringify(r);
};

describe("demo roster", () => {
  it("uses the placeholder class when no secret is set", () => {
    expect(parseDemoRoster(undefined)).toBe(ROSTER);
  });

  it("accepts a complete class list", () => {
    expect(parseDemoRoster(JSON.stringify(ROSTER)).teams).toHaveLength(ROSTER.teams.length);
  });

  it("rejects broken class lists with a clear error", () => {
    expect(() => parseDemoRoster("{not json")).toThrow(/valid JSON/);
    expect(() => parseDemoRoster(edited((r) => (r.teams[0].members[1].role = "Product Owner")))).toThrow(/exactly one Product Owner/);
    expect(() => parseDemoRoster(edited((r) => (r.teams[1].members[0] = { ...r.teams[0].members[0] })))).toThrow(/listed twice/);
    expect(() => parseDemoRoster(edited((r) => (r.scenarios.reviewMember = "Nobody Here")))).toThrow(/reviewTeam/);
    expect(() => parseDemoRoster(edited((r) => (r.scenarios.reviewTeam = "Team Red")))).toThrow(/team of 5/);
  });
});

describe("demo site config", () => {
  const read = (file: string) => JSON.parse(readFileSync(file, "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, ""));

  it("can never point at the real site or database", () => {
    const real = read("wrangler.jsonc");
    const demo = read("wrangler.demo.jsonc");
    expect(demo.name).not.toBe(real.name);
    expect(demo.d1_databases[0].database_id).not.toBe(real.d1_databases[0].database_id);
    expect(demo.d1_databases[0].database_name).not.toBe(real.d1_databases[0].database_name);
    expect(demo.routes[0].pattern).not.toBe(real.routes[0].pattern);
    expect(demo.vars.DEMO_MODE).toBe("1");
    expect(real.vars.DEMO_MODE).toBeUndefined();
  });
});

describe("demo workspace emails", () => {
  it("ties an account to one workspace and hides the tag on screen", () => {
    const email = workspaceEmail("Avery", "Sample", "a1b2c3d4");
    expect(workspaceOf(email)).toBe("a1b2c3d4");
    expect(displayEmail(email)).toBe("avery.sample@fairshare.demo");
    expect(workspaceOf("avery@gmail.com")).toBeNull();
    expect(workspaceOf("avery+a1b2c3d4@gmail.com")).toBeNull();
  });

  it("never leaves a typed email pointing at a real inbox", () => {
    expect(scopeEmail("Real.Person+x@gmail.com", "a1b2c3d4")).toBe("real.person+a1b2c3d4@fairshare.demo");
  });

  it("only recognizes the two shared logins", () => {
    expect(demoLoginRole(" Professor@fairshare.demo ")).toBe("instructor");
    expect(demoLoginRole("student@fairshare.demo")).toBe("student");
    expect(demoLoginRole(workspaceEmail("Avery", "Sample", "a1b2c3d4"))).toBeNull();
  });
});

describe("demo class data", () => {
  const data = buildDemoClass("a1b2c3d4", 5000, NOW, ROSTER);
  const users = table(data, "users");
  const nameOf = (id: unknown) => {
    const u = users.find((x) => x.user_id === id)!;
    return `${u.first_name} ${u.last_name}`;
  };

  it("includes the professor, every student, and both login accounts", () => {
    expect(users).toHaveLength(studentCount + 1);
    expect(users.filter((u) => u.system_role === "instructor").map((u) => `${u.first_name} ${u.last_name}`)).toEqual(["Pat Example"]);
    for (const role of ["instructor", "student"] as const) {
      expect(users.some((u) => u.email === demoHomeEmail(role, "a1b2c3d4", ROSTER))).toBe(true);
    }
  });

  it("keeps every row's ID inside this copy's range", () => {
    for (const { table: name, rows } of data) {
      const idColumn = Object.keys(rows[0] ?? {})[0];
      for (const r of rows) {
        expect(r[idColumn], name).toBeGreaterThan(5000);
        expect(r[idColumn], name).toBeLessThan(6000);
      }
    }
  });

  it("puts the only flag and open dispute on the chosen student", () => {
    const flags = table(data, "integrity_flags");
    expect(flags).toHaveLength(1);
    expect(nameOf(flags[0].rater_id)).toBe(ROSTER.scenarios.reviewMember);

    const open = table(data, "disputes").filter((d) => d.dispute_status === "open");
    expect(open).toHaveLength(1);
    const verification = table(data, "verifications").find((v) => v.verification_id === open[0].verification_id)!;
    const entry = table(data, "contributions").find((c) => c.contribution_id === verification.contribution_id)!;
    expect(nameOf(entry.user_id)).toBe(ROSTER.scenarios.reviewMember);
  });

  it("never has anyone confirm their own work", () => {
    const contributions = table(data, "contributions");
    for (const v of table(data, "verifications")) {
      expect(contributions.find((c) => c.contribution_id === v.contribution_id)!.user_id).not.toBe(v.verifier_id);
    }
  });

  it("leaves the default student's Milestone 1 ratings for the visitor", () => {
    const student = users.find((u) => `${u.first_name} ${u.last_name}` === ROSTER.scenarios.defaultStudent)!.user_id;
    expect(table(data, "contribution_shares").some((e) => e.evaluator_id === student)).toBe(false);
  });

  it("gives every rater's split a total of exactly 100%", () => {
    const totals = new Map<unknown, number>();
    for (const s of table(data, "contribution_shares")) totals.set(s.evaluator_id, (totals.get(s.evaluator_id) ?? 0) + Number(s.share_bp));
    expect(totals.size).toBeGreaterThan(0);
    for (const total of totals.values()) expect(total).toBe(10000);
  });
});
