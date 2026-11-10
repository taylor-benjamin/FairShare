// ─────────────────────────────────────────────────────────────────────────────
//  CONTRIBUTION FORMULA — the one place to change how adjusted grades work.
// ─────────────────────────────────────────────────────────────────────────────
//
//  adjusted grade = team grade × (member's average peer rating ÷ team's average peer rating)
//
//  • Ratings come from every *completed* milestone in the project.
//  • The result is capped between MIN_PERCENT and MAX_PERCENT of the 100-point scale.
//  • A member with no ratings yet keeps the team grade (factor = 1).
//  • Confirmed hours are shown next to the grade as supporting evidence; they are
//    not part of the math, so the formula stays easy to explain to a student.

export const CONTRIBUTION_FORMULA = {
  /** Shown on screen above the table. */
  label: "Adjusted grade = team grade × (your average peer rating ÷ your team's average peer rating)",
  /** Lowest and highest adjusted grade, in percent. */
  MIN_PERCENT: 0,
  MAX_PERCENT: 105,
  /** Team grade used when the instructor has not typed one in yet. */
  DEFAULT_TEAM_GRADE: 100,
  /** Decimal places shown for the factor and the grade. */
  DECIMALS: 1,
} as const;

export interface ContributionInput {
  teamGrade: number; // 0–100
  memberAverage: number | null; // the member's average received rating, or null if none
  teamAverage: number | null; // average of every rating given in the team
}

export interface ContributionResult {
  factor: number;
  rawGrade: number;
  adjustedGrade: number;
  capped: "low" | "high" | null;
  /** Plain-language working, e.g. "90 × (4.5 ÷ 4.0) = 101.3". */
  explanation: string;
}

function round(n: number, decimals: number = CONTRIBUTION_FORMULA.DECIMALS): number {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

export function computeAdjustedGrade({ teamGrade, memberAverage, teamAverage }: ContributionInput): ContributionResult {
  const { MIN_PERCENT, MAX_PERCENT } = CONTRIBUTION_FORMULA;

  if (memberAverage === null || teamAverage === null || teamAverage <= 0) {
    const g = Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, teamGrade));
    return {
      factor: 1,
      rawGrade: teamGrade,
      adjustedGrade: round(g),
      capped: null,
      explanation: `No peer ratings yet, so the team grade stands: ${round(g)}`,
    };
  }

  const factor = memberAverage / teamAverage;
  const rawGrade = teamGrade * factor;
  let adjusted = rawGrade;
  let capped: ContributionResult["capped"] = null;
  if (adjusted > MAX_PERCENT) {
    adjusted = MAX_PERCENT;
    capped = "high";
  } else if (adjusted < MIN_PERCENT) {
    adjusted = MIN_PERCENT;
    capped = "low";
  }

  let explanation = `${round(teamGrade)} × (${memberAverage.toFixed(2)} ÷ ${teamAverage.toFixed(2)}) = ${round(rawGrade)}`;
  if (capped === "high") explanation += ` → capped at ${MAX_PERCENT}`;
  if (capped === "low") explanation += ` → raised to ${MIN_PERCENT}`;

  return { factor: round(factor, 3), rawGrade: round(rawGrade), adjustedGrade: round(adjusted), capped, explanation };
}
