// Pure business rules. No database, no I/O — services feed them data and act on the result.
// Unit-tested in tests/rules.test.ts.

import { EARLY_WARNING, INTEGRITY_RULES } from "@/config/integrity-rules";
import type { Decision, FlagType, VerificationStatus } from "./types";

// ── Claim-and-verify ─────────────────────────────────────────────────────────

/**
 * A contribution becomes confirmed once a majority of the *other* team members confirm it.
 * Any dispute makes it disputed (and the service opens a dispute for the instructor).
 */
export function nextVerificationStatus(otherMemberCount: number, decisions: Decision[]): VerificationStatus {
  if (decisions.includes("dispute")) return "disputed";
  const confirms = decisions.filter((d) => d === "confirm").length;
  if (otherMemberCount > 0 && confirms > otherMemberCount / 2) return "confirmed";
  return "pending";
}

/** What happens to a disputed contribution when the instructor resolves the dispute. */
export function statusAfterDisputeResolution(resolution: "upheld" | "rejected"): VerificationStatus {
  // upheld  = the teammate was right; the claim stays disputed and earns no credit.
  // rejected = the claim stands; the instructor's review counts as verification.
  return resolution === "upheld" ? "disputed" : "confirmed";
}

// ── Team charter ─────────────────────────────────────────────────────────────

export function isCharterComplete(members: { role_confirmed: number; team_role: string | null }[]): boolean {
  return members.length > 0 && members.every((m) => m.role_confirmed === 1 && !!m.team_role?.trim());
}

// ── Integrity flags (P16) ────────────────────────────────────────────────────

export interface Rating {
  evaluatorId: number;
  evaluateeId: number;
  score: number;
}

export interface DetectedFlag {
  raterId: number;
  type: FlagType;
  details: string;
}

/**
 * Looks at one team's ratings for one milestone and returns the patterns worth a second look.
 * memberIds = everyone on the team; names is used only to write readable details.
 */
export function detectIntegrityFlags(ratings: Rating[], memberIds: number[], names: Record<number, string> = {}): DetectedFlag[] {
  const flags: DetectedFlag[] = [];
  const name = (id: number) => names[id] ?? `Member ${id}`;

  // (a) Identical scores: the rater rated every teammate and gave them all the same score.
  for (const raterId of memberIds) {
    const given = ratings.filter((r) => r.evaluatorId === raterId);
    const teammates = memberIds.filter((id) => id !== raterId);
    const ratedEveryone = teammates.length > 0 && teammates.every((t) => given.some((g) => g.evaluateeId === t));
    if (ratedEveryone && given.length >= INTEGRITY_RULES.IDENTICAL_MIN_RATINGS && new Set(given.map((g) => g.score)).size === 1) {
      flags.push({
        raterId,
        type: "identical_scores",
        details: `${name(raterId)} gave all ${given.length} teammates a ${given[0].score}.`,
      });
    }
  }

  // (b) Reciprocal inflation: two members rate each other well above the team's average.
  if (ratings.length > 0) {
    const teamAverage = ratings.reduce((s, r) => s + r.score, 0) / ratings.length;
    const threshold = Math.max(INTEGRITY_RULES.RECIPROCAL_MIN_SCORE, teamAverage + INTEGRITY_RULES.RECIPROCAL_MARGIN);
    const seen = new Set<string>();
    for (const ab of ratings) {
      const ba = ratings.find((r) => r.evaluatorId === ab.evaluateeId && r.evaluateeId === ab.evaluatorId);
      if (!ba) continue;
      const key = [ab.evaluatorId, ab.evaluateeId].sort((x, y) => x - y).join("-");
      if (seen.has(key)) continue;
      seen.add(key);
      if (ab.score >= threshold && ba.score >= threshold) {
        const details = `${name(ab.evaluatorId)} and ${name(ab.evaluateeId)} rated each other ${ab.score} and ${ba.score}; team average is ${teamAverage.toFixed(1)}.`;
        flags.push({ raterId: ab.evaluatorId, type: "reciprocal_scores", details });
        flags.push({ raterId: ab.evaluateeId, type: "reciprocal_scores", details });
      }
    }
  }

  return flags;
}

// ── Averages ─────────────────────────────────────────────────────────────────

export function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

// ── Early warning ────────────────────────────────────────────────────────────

export interface MemberActivity {
  userId: number;
  name: string;
  lastLoggedDate: string | null; // ISO date-time of their most recent contribution
}

/** Members with no logged work in the last INACTIVE_DAYS days. */
export function inactiveMembers(members: MemberActivity[], now: Date, days: number = EARLY_WARNING.INACTIVE_DAYS): MemberActivity[] {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return members.filter((m) => !m.lastLoggedDate || new Date(m.lastLoggedDate).getTime() < cutoff);
}

// ── Roster CSV (P06) ─────────────────────────────────────────────────────────

export interface RosterRow {
  first_name: string;
  last_name: string;
  email: string;
  team_name: string;
}

export interface RosterParseResult {
  rows: RosterRow[];
  errors: string[];
}

const REQUIRED_COLUMNS = ["first_name", "last_name", "email", "team_name"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Splits one CSV line, honouring double-quoted fields ("Smith, Jr."). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Parses and checks a roster file. Errors are written for a non-technical reader. */
export function parseRosterCsv(text: string): RosterParseResult {
  const errors: string[] = [];
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { rows: [], errors: ["The file is empty. Export your class list from Moodle as a CSV file and try again."] };
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        `The first row must name the columns. We couldn't find: ${missing.join(", ")}. ` +
          `The first row should read: first_name, last_name, email, team_name`,
      ],
    };
  }
  const idx = Object.fromEntries(REQUIRED_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<(typeof REQUIRED_COLUMNS)[number], number>;

  if (lines.length === 1) {
    return { rows: [], errors: ["The file has column names but no students. Add one row per student."] };
  }

  const rows: RosterRow[] = [];
  const seenEmails = new Map<string, number>();
  for (let i = 1; i < lines.length; i++) {
    const lineNo = i + 1;
    const cells = splitCsvLine(lines[i]);
    const row: RosterRow = {
      first_name: cells[idx.first_name] ?? "",
      last_name: cells[idx.last_name] ?? "",
      email: (cells[idx.email] ?? "").toLowerCase(),
      team_name: cells[idx.team_name] ?? "",
    };
    const problems: string[] = [];
    if (!row.first_name) problems.push("first name is blank");
    else if (row.first_name.length > 50) problems.push("first name is longer than 50 characters");
    if (!row.last_name) problems.push("last name is blank");
    else if (row.last_name.length > 50) problems.push("last name is longer than 50 characters");
    if (!row.email) problems.push("email is blank");
    else if (!EMAIL_RE.test(row.email) || row.email.length > 100) problems.push(`"${row.email}" doesn't look like an email address`);
    if (!row.team_name) problems.push("team name is blank");
    else if (row.team_name.length > 50) problems.push("team name is longer than 50 characters");

    if (row.email && seenEmails.has(row.email)) {
      problems.push(`${row.email} is already listed on row ${seenEmails.get(row.email)}`);
    }

    if (problems.length > 0) {
      errors.push(`Row ${lineNo}: ${problems.join("; ")}.`);
    } else {
      seenEmails.set(row.email, lineNo);
      rows.push(row);
    }
  }

  if (errors.length === 0) {
    const teamSizes = new Map<string, number>();
    for (const r of rows) teamSizes.set(r.team_name, (teamSizes.get(r.team_name) ?? 0) + 1);
    for (const [team, size] of teamSizes) {
      if (size < 2) errors.push(`${team} has only one student. Teams need at least two people so they can confirm each other's work.`);
    }
  }

  return { rows, errors };
}

/** Groups valid roster rows by team, keeping the order teams first appear in. */
export function groupRosterByTeam(rows: RosterRow[]): Map<string, RosterRow[]> {
  const map = new Map<string, RosterRow[]>();
  for (const r of rows) {
    if (!map.has(r.team_name)) map.set(r.team_name, []);
    map.get(r.team_name)!.push(r);
  }
  return map;
}

// ── Form validation helpers ──────────────────────────────────────────────────

export function validateHours(raw: string): { value: number | null; error?: string } {
  if (raw.trim() === "") return { value: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0.5 || n > 24) return { value: null, error: "Enter a number from 0.5 to 24." };
  return { value: Math.round(n * 10) / 10 };
}

export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00:00Z").getTime());
}
