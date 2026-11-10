// Peer Evaluation Service — ratings (P15), anonymity (P12), integrity flags (P16), contribution formula.
import "server-only";
import { computeAdjustedGrade, CONTRIBUTION_FORMULA } from "@/config/contribution-formula";
import { authorize } from "../permissions";
import { contributions, evaluations, flags, memberships, milestones } from "../data/repo";
import { average, detectIntegrityFlags } from "../rules";
import type { SessionUser } from "../types";
import { authorizeTeam, fullName, NotFoundError, shortName, UserError } from "./common";

function isAnonymous(anonymousEvals: number | null): boolean {
  return anonymousEvals !== 0; // NULL falls back to the safe default: anonymous
}

/** What a student sees on the Ratings tab: completed milestones and whether they've rated yet. */
export async function getRatingsPage(user: SessionUser | null, teamId: number) {
  const { team } = await authorizeTeam(user, "evaluation.submit", teamId);
  const [ms, members, given] = await Promise.all([
    milestones.byProject(team.project_id),
    memberships.byTeam(teamId),
    evaluations.givenBy(teamId, user!.userId),
  ]);
  const teammates = members.filter((m) => m.user_id !== user!.userId);
  return {
    team,
    anonymous: isAnonymous(team.anonymous_evals),
    teammates,
    milestones: ms.map((m) => ({
      ...m,
      submitted: given.some((g) => g.milestone_id === m.milestone_id),
      myRatings: given.filter((g) => g.milestone_id === m.milestone_id),
    })),
  };
}

/** P15 — rate every teammate 1–5 for a completed milestone, then run the integrity checks (P16). */
export async function submitRatings(
  user: SessionUser | null,
  teamId: number,
  milestoneId: number,
  ratings: { evaluateeId: number; score: number; comment: string | null }[],
) {
  const { team } = await authorizeTeam(user, "evaluation.submit", teamId);
  const ms = await milestones.byId(milestoneId);
  if (!ms || ms.project_id !== team.project_id) throw new NotFoundError("That milestone isn't part of this project.");
  if (ms.milestone_status !== "completed") throw new UserError("Ratings open once your instructor marks this milestone complete.");

  const members = await memberships.byTeam(teamId);
  const teammateIds = members.filter((m) => m.user_id !== user!.userId).map((m) => m.user_id);
  const already = (await evaluations.givenBy(teamId, user!.userId)).some((e) => e.milestone_id === milestoneId);
  if (already) throw new UserError("You've already submitted ratings for this milestone.");

  for (const id of teammateIds) {
    const r = ratings.find((x) => x.evaluateeId === id);
    if (!r || !Number.isInteger(r.score) || r.score < 1 || r.score > 5) {
      throw new UserError("Rate every teammate from 1 to 5 before submitting.");
    }
  }
  const clean = teammateIds.map((id) => {
    const r = ratings.find((x) => x.evaluateeId === id)!;
    return { evaluateeId: id, score: r.score, comment: r.comment?.trim().slice(0, 1000) || null };
  });
  await evaluations.saveSet(milestoneId, teamId, user!.userId, clean);
  await runIntegrityChecks(teamId, milestoneId);
}

/** Re-checks a team's ratings for one milestone and records any new flags. Safe to run repeatedly. */
export async function runIntegrityChecks(teamId: number, milestoneId: number) {
  const [all, members] = await Promise.all([evaluations.byTeamMilestone(teamId, milestoneId), memberships.byTeam(teamId)]);
  const names = Object.fromEntries(members.map((m) => [m.user_id, fullName(m)]));
  const found = detectIntegrityFlags(
    all.map((e) => ({ evaluatorId: e.evaluator_id, evaluateeId: e.evaluatee_id, score: e.score })),
    members.map((m) => m.user_id),
    names,
  );
  for (const f of found) {
    await flags.insertIfNew({ milestoneId, teamId, raterId: f.raterId, type: f.type, details: f.details });
  }
}

/** A student's own received ratings (P12): evaluator names are hidden when the project is anonymous. */
export async function myFeedback(user: SessionUser | null, teamId: number) {
  const { team } = await authorizeTeam(user, "evaluation.readOwn", teamId);
  const anonymous = isAnonymous(team.anonymous_evals);
  const [received, allTeam, hours] = await Promise.all([
    evaluations.receivedBy(teamId, user!.userId),
    evaluations.byTeamCompleted(teamId),
    contributions.hoursByMember(teamId),
  ]);
  const completedReceived = received.filter((r) => allTeam.some((a) => a.evaluation_id === r.evaluation_id));
  const myAvg = average(completedReceived.map((r) => r.score));
  const teamAvg = average(allTeam.map((r) => r.score));
  const mine = hours.find((h) => h.user_id === user!.userId);
  return {
    team,
    anonymous,
    // Strip identities before they leave the service when anonymous.
    ratings: completedReceived.map((r) => ({
      evaluationId: r.evaluation_id,
      milestone: r.milestone_name,
      score: r.score,
      comment: r.comment,
      from: anonymous ? null : `${r.evaluator_first} ${r.evaluator_last}`,
    })),
    myAverage: myAvg,
    teamAverage: teamAvg,
    factor: myAvg !== null && teamAvg ? myAvg / teamAvg : null,
    confirmedHours: mine?.confirmed_hours ?? 0,
    confirmedCount: mine?.confirmed_count ?? 0,
  };
}

/** Instructor view of one team's ratings and contribution scores, with the math shown. */
export async function teamResults(user: SessionUser | null, teamId: number, teamGradeRaw: number | null) {
  const { team } = await authorizeTeam(user, "evaluation.readAll", teamId);
  const teamGrade = teamGradeRaw !== null && Number.isFinite(teamGradeRaw) && teamGradeRaw >= 0 && teamGradeRaw <= 100 ? teamGradeRaw : CONTRIBUTION_FORMULA.DEFAULT_TEAM_GRADE;
  const [members, completed, hours, ms] = await Promise.all([
    memberships.byTeam(teamId),
    evaluations.byTeamCompleted(teamId),
    contributions.hoursByMember(teamId),
    milestones.byProject(team.project_id),
  ]);
  const teamAverage = average(completed.map((e) => e.score));
  const rows = members.map((m) => {
    const received = completed.filter((e) => e.evaluatee_id === m.user_id);
    const memberAverage = average(received.map((e) => e.score));
    const h = hours.find((x) => x.user_id === m.user_id);
    return {
      userId: m.user_id,
      name: fullName(m),
      short: shortName(m),
      role: m.team_role,
      ratingCount: received.length,
      memberAverage,
      confirmedHours: h?.confirmed_hours ?? 0,
      confirmedCount: h?.confirmed_count ?? 0,
      pendingCount: h?.pending_count ?? 0,
      disputedCount: h?.disputed_count ?? 0,
      result: computeAdjustedGrade({ teamGrade, memberAverage, teamAverage }),
    };
  });
  const matrix = ms
    .filter((m) => m.milestone_status === "completed")
    .map((m) => ({
      milestone: m,
      ratings: completed
        .filter((e) => e.milestone_id === m.milestone_id)
        .map((e) => ({
          from: shortName(members.find((x) => x.user_id === e.evaluator_id) ?? { first_name: "?", last_name: "?" }),
          to: shortName(members.find((x) => x.user_id === e.evaluatee_id) ?? { first_name: "?", last_name: "?" }),
          fromId: e.evaluator_id,
          toId: e.evaluatee_id,
          score: e.score,
          comment: e.comment,
        })),
    }));
  return { team, teamGrade, teamAverage, rows, matrix, formula: CONTRIBUTION_FORMULA };
}

// ── Integrity flag review (P16) ──────────────────────────────────────────────

export async function flagQueue(user: SessionUser | null) {
  authorize(user, "course.create"); // instructors only; the query is scoped to their own courses
  const [open, reviewed] = await Promise.all([flags.forInstructor(user.userId, "open"), flags.forInstructor(user.userId, "reviewed")]);
  return { open, reviewed: reviewed.slice(0, 20) };
}

export async function reviewFlag(user: SessionUser | null, flagId: number, status: "dismissed" | "confirmed") {
  const f = await flags.byId(flagId);
  if (!f) throw new NotFoundError("That flag doesn't exist.");
  await authorizeTeam(user, "flag.review", f.team_id);
  if (status !== "dismissed" && status !== "confirmed") throw new UserError("Choose dismiss or confirm.");
  await flags.review(flagId, status);
}
