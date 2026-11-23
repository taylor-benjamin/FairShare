// Peer Evaluation Service: ratings (P15), anonymity (P12), integrity flags (P16).
import "server-only";
import { authorize } from "../permissions";
import { contributionShares, contributions, evaluations, flags, memberships, milestones } from "../data/repo";
import { average, compareShares, detectShareFlags, FULL_SHARE, splitShares } from "../rules";
import type { SessionUser } from "../types";
import { authorizeTeam, fullName, NotFoundError, shortName, UserError } from "./common";

function isAnonymous(anonymousEvals: number | null): boolean {
  return anonymousEvals !== 0; // NULL falls back to the safe default: anonymous
}

/** What a student sees on the Ratings tab: milestones, whether they've rated yet, and a slider per member. */
export async function getRatingsPage(user: SessionUser | null, teamId: number) {
  const { team } = await authorizeTeam(user, "evaluation.submit", teamId);
  const [ms, members, given, givenShares] = await Promise.all([
    milestones.byProject(team.project_id),
    memberships.byTeam(teamId),
    evaluations.givenBy(teamId, user!.userId),
    contributionShares.givenBy(teamId, user!.userId),
  ]);
  const teammates = members.filter((m) => m.user_id !== user!.userId);
  const me = members.find((m) => m.user_id === user!.userId);
  // You first, then teammates. The starting split is even and always totals exactly 100%.
  const raters = me ? [me, ...teammates] : teammates;
  const evenSplit = splitShares(raters.map(() => 1));
  return {
    team,
    anonymous: isAnonymous(team.anonymous_evals),
    teammates,
    sliders: raters.map((m, i) => ({
      userId: m.user_id,
      name: `${m.first_name} ${m.last_name}`,
      role: m.team_role,
      isSelf: m.user_id === user!.userId,
      startBp: evenSplit[i],
    })),
    members,
    milestones: ms.map((m) => {
      const myShares = givenShares.filter((g) => g.milestone_id === m.milestone_id);
      const myRatings = given.filter((g) => g.milestone_id === m.milestone_id); // Past 1 to 5 ratings
      return { ...m, submitted: myShares.length > 0 || myRatings.length > 0, myShares, myRatings };
    }),
  };
}

/** P15: split a completed milestone's work across everyone, then run the integrity checks (P16). */
export async function submitRatings(
  user: SessionUser | null,
  teamId: number,
  milestoneId: number,
  ratings: { evaluateeId: number; shareBp: number | null; comment: string | null }[],
) {
  const { team } = await authorizeTeam(user, "evaluation.submit", teamId);
  const ms = await milestones.byId(milestoneId);
  if (!ms || ms.project_id !== team.project_id) throw new NotFoundError("That milestone isn't part of this project.");
  if (ms.milestone_status !== "completed") throw new UserError("Ratings open once your instructor marks this milestone complete.");

  const members = await memberships.byTeam(teamId);
  if (members.length < 2) throw new UserError("There's no one to rate yet.");
  const [oldRatings, oldShares] = await Promise.all([evaluations.givenBy(teamId, user!.userId), contributionShares.givenBy(teamId, user!.userId)]);
  if ([...oldRatings, ...oldShares].some((e) => e.milestone_id === milestoneId)) throw new UserError("You've already submitted ratings for this milestone.");

  const clean = members.map((m) => {
    const r = ratings.find((x) => x.evaluateeId === m.user_id);
    if (!r || r.shareBp === null || !Number.isInteger(r.shareBp) || r.shareBp < 0 || r.shareBp > FULL_SHARE) {
      throw new UserError("Rate everyone from 0 to 100%.");
    }
    return { evaluateeId: m.user_id, shareBp: r.shareBp, comment: r.comment?.trim().slice(0, 1000) || null };
  });
  if (clean.reduce((s, r) => s + r.shareBp, 0) !== FULL_SHARE) throw new UserError("Ratings must total 100%.");
  await contributionShares.saveSet(milestoneId, teamId, user!.userId, clean);
  await runIntegrityChecks(teamId, milestoneId);
}

/** Re-checks a team's ratings for one milestone and records any new flags. Safe to run repeatedly. */
export async function runIntegrityChecks(teamId: number, milestoneId: number) {
  const [all, members] = await Promise.all([contributionShares.byTeamMilestone(teamId, milestoneId), memberships.byTeam(teamId)]);
  const names = Object.fromEntries(members.map((m) => [m.user_id, fullName(m)]));
  const found = detectShareFlags(
    all.map((e) => ({ evaluatorId: e.evaluator_id, evaluateeId: e.evaluatee_id, shareBp: e.share_bp })),
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
  const [received, allTeam, hours, shares, members] = await Promise.all([
    evaluations.receivedBy(teamId, user!.userId),
    evaluations.byTeamCompleted(teamId),
    contributions.hoursByMember(teamId),
    contributionShares.byTeamCompleted(teamId),
    memberships.byTeam(teamId),
  ]);
  const completedReceived = received.filter((r) => allTeam.some((a) => a.evaluation_id === r.evaluation_id));
  const myAvg = average(completedReceived.map((r) => r.score));
  const teamAvg = average(allTeam.map((r) => r.score));
  const mine = hours.find((h) => h.user_id === user!.userId);

  // Self rating next to the teammates' average, per milestone. Only this student's own numbers leave the service.
  const milestoneIds = [...new Set(shares.map((s) => s.milestone_id))];
  const memberIds = members.map((m) => m.user_id);
  const shareMilestones = milestoneIds.flatMap((id) => {
    const rows = shares.filter((s) => s.milestone_id === id);
    const c = compareShares(
      rows.map((s) => ({ evaluatorId: s.evaluator_id, evaluateeId: s.evaluatee_id, shareBp: s.share_bp })),
      memberIds,
    ).find((x) => x.userId === user!.userId);
    if (!c || (c.selfBp === null && c.peerCount === 0)) return [];
    return [
      {
        milestoneId: id,
        milestone: rows[0].milestone_name,
        selfBp: c.selfBp,
        peerAvgBp: c.peerAvgBp,
        peerCount: c.peerCount,
        gapBp: c.gapBp,
        from: rows
          .filter((s) => s.evaluatee_id === user!.userId && s.evaluator_id !== user!.userId)
          .map((s) => ({ id: s.share_id, shareBp: s.share_bp, name: anonymous ? null : `${s.evaluator_first} ${s.evaluator_last}` })),
      },
    ];
  });

  return {
    team,
    anonymous,
    shareMilestones,
    // Strip identities before they leave the service when anonymous.
    ratings: completedReceived.map((r) => ({
      evaluationId: r.evaluation_id,
      milestone: r.milestone_name,
      score: r.score,
      // Comments are written "for your instructor" (P12), so they never reach the person rated.
      from: anonymous ? null : `${r.evaluator_first} ${r.evaluator_last}`,
    })),
    myAverage: myAvg,
    teamAverage: teamAvg,
    confirmedHours: mine?.confirmed_hours ?? 0,
    confirmedCount: mine?.confirmed_count ?? 0,
  };
}

/** Instructor view of one team's peer ratings, with evaluator names. */
export async function teamRatings(user: SessionUser | null, teamId: number) {
  const { team } = await authorizeTeam(user, "evaluation.readAll", teamId);
  const [members, completed, shares, ms] = await Promise.all([
    memberships.byTeam(teamId),
    evaluations.byTeamCompleted(teamId),
    contributionShares.byTeamCompleted(teamId),
    milestones.byProject(team.project_id),
  ]);
  const nameOf = (id: number) => shortName(members.find((x) => x.user_id === id) ?? { first_name: "?", last_name: "?" });
  const matrix = ms
    .filter((m) => m.milestone_status === "completed")
    .map((m) => {
      const milestoneShares = shares.filter((s) => s.milestone_id === m.milestone_id);
      return {
        milestone: m,
        ratings: [
          ...milestoneShares.map((s) => ({
            from: nameOf(s.evaluator_id),
            to: nameOf(s.evaluatee_id),
            fromId: s.evaluator_id,
            toId: s.evaluatee_id,
            score: null as number | null,
            shareBp: s.share_bp as number | null,
            comment: s.comment,
          })),
          ...completed
            .filter((e) => e.milestone_id === m.milestone_id)
            .map((e) => ({
              from: nameOf(e.evaluator_id),
              to: nameOf(e.evaluatee_id),
              fromId: e.evaluator_id,
              toId: e.evaluatee_id,
              score: e.score as number | null,
              shareBp: null as number | null,
              comment: e.comment,
            })),
        ],
        comparison: milestoneShares.length === 0
          ? []
          : compareShares(
              milestoneShares.map((s) => ({ evaluatorId: s.evaluator_id, evaluateeId: s.evaluatee_id, shareBp: s.share_bp })),
              members.map((x) => x.user_id),
            ).map((c) => ({ ...c, name: nameOf(c.userId) })),
      };
    });
  return { team, matrix };
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
