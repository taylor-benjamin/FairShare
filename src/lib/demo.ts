// Demo mode's pure logic (no I/O): workspace emails and the starting data for one visitor's private class.
// Every account in a copy has an email like first.last+<workspace>@fairshare.demo, which keeps copies apart.
// The inactive, disputed and flagged scenarios all sit on one chosen student so no one else is shown that way.
import { DEMO_DOMAIN, DEMO_LOGINS, DEMO_PLACEHOLDER_ROSTER, type DemoMember, type DemoRoster, type DemoTeam } from "../config/demo-class";
import { detectShareFlags, splitShares, type ShareRating } from "./rules";

const WORKSPACE_EMAIL = /\+([a-f0-9]{8})@fairshare\.demo$/i;
const DAY = 24 * 60 * 60 * 1000;

export type DemoRow = Record<string, string | number | null>;
export interface DemoTableRows {
  table: string;
  rows: DemoRow[];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export const workspaceEmail = (first: string, last: string, workspace: string) => `${slug(first)}.${slug(last)}+${workspace}@${DEMO_DOMAIN}`;

/** The workspace an account belongs to, or null if it isn't a demo copy account. */
export function workspaceOf(email: string): string | null {
  return WORKSPACE_EMAIL.exec(email)?.[1]?.toLowerCase() ?? null;
}

/** Hides the workspace tag when an email is shown on screen. */
export const displayEmail = (email: string) => email.replace(WORKSPACE_EMAIL, `@${DEMO_DOMAIN}`);

/** Turns any typed email into an address inside this workspace, so a demo can never reach a real inbox or account. */
export function scopeEmail(email: string, workspace: string): string {
  const local = email.split("@")[0].split("+")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 60) || "student";
  return `${local}+${workspace}@${DEMO_DOMAIN}`;
}

/** Which shared login this email is, if any. */
export function demoLoginRole(email: string): "instructor" | "student" | null {
  const e = email.trim().toLowerCase();
  if (e === DEMO_LOGINS.instructor) return "instructor";
  if (e === DEMO_LOGINS.student) return "student";
  return null;
}

const fullName = (m: { first: string; last: string }) => `${m.first} ${m.last}`;
const memberNamed = (team: DemoTeam | undefined, name: string) => team?.members.find((m) => fullName(m) === name);

export function demoHomeEmail(role: "instructor" | "student", workspace: string, roster: DemoRoster = DEMO_PLACEHOLDER_ROSTER) {
  if (role === "instructor") return workspaceEmail(roster.professor.first, roster.professor.last, workspace);
  const team = roster.teams.find((t) => t.name === roster.scenarios.reviewTeam);
  const student = memberNamed(team, roster.scenarios.defaultStudent)!;
  return workspaceEmail(student.first, student.last, workspace);
}

/** Reads the DEMO_ROSTER secret. No secret means placeholder names; a broken one stops with a clear error. */
export function parseDemoRoster(raw: string | undefined): DemoRoster {
  if (!raw) return DEMO_PLACEHOLDER_ROSTER;
  let r: DemoRoster;
  try {
    r = JSON.parse(raw) as DemoRoster;
  } catch {
    throw new Error("DEMO_ROSTER isn't valid JSON.");
  }
  const fail = (why: string): never => {
    throw new Error(`DEMO_ROSTER: ${why}`);
  };
  if (!r?.course?.code || !r.course.name || !r.course.section || !r.course.project) fail("course is incomplete.");
  if (!r.professor?.first || !r.professor.last) fail("professor is incomplete.");
  if (!Array.isArray(r.teams) || r.teams.length === 0) fail("there are no teams.");
  const emails = new Set([workspaceEmail(r.professor.first, r.professor.last, "00000000")]);
  for (const t of r.teams) {
    if (!t.name || !["published", "finished"].includes(t.status) || !Array.isArray(t.members)) fail("a team is incomplete.");
    if (t.members.length < 4) fail(`${t.name} needs at least 4 members.`);
    for (const m of t.members) {
      if (!m.first || !m.last || !["Scrum Master", "Product Owner", "Developer"].includes(m.role)) fail(`${t.name} has an incomplete member.`);
      const email = workspaceEmail(m.first, m.last, "00000000");
      if (emails.has(email)) fail(`${fullName(m)} is listed twice.`);
      emails.add(email);
    }
    for (const role of ["Scrum Master", "Product Owner"]) {
      if (t.members.filter((m) => m.role === role).length !== 1) fail(`${t.name} needs exactly one ${role}.`);
    }
  }
  const s = r.scenarios;
  const team = (name: string) => r.teams.find((t) => t.name === name);
  const review = team(s?.reviewTeam);
  if (!review || review.members.length !== 5 || review.status !== "published") fail("reviewTeam must be a published team of 5.");
  const subject = memberNamed(review, s.reviewMember);
  const student = memberNamed(review, s.defaultStudent);
  if (!subject || !student || subject === student) fail("reviewMember and defaultStudent must be two people on reviewTeam.");
  if (subject!.role === "Product Owner" || student!.role === "Product Owner") fail("reviewMember and defaultStudent can't be the Product Owner.");
  const charter = team(s.charterTeam);
  if (!charter || charter === review || charter.status !== "published" || charter.members.filter((m) => m.role === "Developer").length < 2) fail("charterTeam must be another published team with 2 Developers.");
  const invite = team(s.inviteTeam);
  if (!invite || invite.status !== "published") fail("inviteTeam must be a published team.");
  return r;
}

const SCRUM_WORK = [
  { text: "Ran sprint planning and set the sprint goal", hours: 1.5 },
  { text: "Facilitated the sprint retrospective", hours: 1 },
];
const OWNER_WORK = [
  { text: "Wrote and prioritized the product backlog", hours: 3 },
  { text: "Reviewed user stories with the team", hours: 1.5 },
];
const DEV_WORK = [
  { text: "Built the team dashboard screen", hours: 4 },
  { text: "Connected the work log to the database", hours: 3.5 },
  { text: "Built the peer rating form", hours: 3 },
  { text: "Tested the app at phone width", hours: 2 },
  { text: "Fixed date handling on the task board", hours: 1.5 },
  { text: "Wrote the sprint test cases", hours: 2.5 },
];

const CHARTER = {
  goals: "Ship a working product each sprint and finish every milestone on time.",
  expectations: "Reply within 24 hours. Log work the day you finish it. Raise blockers at standup.",
};

/** Builds one visitor's class. IDs start at `base`, so copies never share a row. */
export function buildDemoClass(workspace: string, base: number, nowMs: number, roster: DemoRoster = DEMO_PLACEHOLDER_ROSTER): DemoTableRows[] {
  const at = (daysAgo: number, hour = 15) => {
    const d = new Date(nowMs - daysAgo * DAY);
    d.setUTCHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const date = (daysAgo: number) => at(daysAgo).slice(0, 10);
  const next = (() => {
    const counters = new Map<string, number>();
    return (table: string) => {
      const n = (counters.get(table) ?? 0) + 1;
      counters.set(table, n);
      return base + n;
    };
  })();

  const rows: Record<string, DemoRow[]> = {};
  const add = (table: string, row: DemoRow) => {
    (rows[table] ??= []).push(row);
    return row;
  };

  const userIds = new Map<string, number>();
  const key = (m: { first: string; last: string }) => `${m.first} ${m.last}`;
  const addUser = (m: { first: string; last: string }, role: "instructor" | "student") => {
    const id = next("users");
    userIds.set(key(m), id);
    add("users", {
      user_id: id,
      first_name: m.first,
      last_name: m.last,
      email: workspaceEmail(m.first, m.last, workspace),
      // Not a valid hash, so these accounts can only be reached through the shared logins and the demo bar.
      password_hash: "demo-no-login",
      system_role: role,
      created_date: new Date(nowMs).toISOString(),
    });
    return id;
  };
  const uid = (first: string, last: string) => userIds.get(`${first} ${last}`)!;

  const idOf = (m: { first: string; last: string }) => uid(m.first, m.last);
  const professor = addUser(roster.professor, "instructor");
  for (const t of roster.teams) for (const m of t.members) addUser(m, "student");

  const courseId = next("courses");
  add("courses", { course_id: courseId, instructor_id: professor, course_code: roster.course.code, course_name: roster.course.name, section_number: roster.course.section });
  const projectId = next("projects");
  add("projects", { project_id: projectId, course_id: courseId, template_id: 1, project_name: roster.course.project, start_date: date(56), end_date: date(-35), anonymous_evals: 1, member_access: "write" });

  const milestone1 = next("milestones");
  add("milestones", { milestone_id: milestone1, project_id: projectId, milestone_name: "Milestone 1: Vision and Scope", due_date: date(28), milestone_status: "completed", completion_date: at(27) });
  add("milestones", { milestone_id: next("milestones"), project_id: projectId, milestone_name: "Milestone 2: Working Prototype", due_date: date(-7), milestone_status: "open", completion_date: null });
  add("milestones", { milestone_id: next("milestones"), project_id: projectId, milestone_name: "Milestone 3: Final Presentation", due_date: date(-30), milestone_status: "open", completion_date: null });

  const addTask = (teamId: number, owner: number | null, title: string, due: string | null, status: string, request?: number) => {
    const id = next("tasks");
    add("tasks", {
      task_id: id,
      team_id: teamId,
      user_id: owner,
      task_title: title,
      due_date: due,
      task_status: status,
      delete_requested_by_id: request ?? null,
      delete_requested_date: request ? at(1) : null,
    });
    return id;
  };

  type Entry = { by: number; text: string; hours: number; daysAgo: number; task?: number; confirms: number[]; dispute?: { by: number; reason: string; resolved?: string } };
  const addEntries = (teamId: number, size: number, entries: Entry[]) => {
    for (const c of entries) {
      const others = size - 1;
      let status = c.confirms.length * 2 > others ? "confirmed" : "pending";
      if (c.dispute) status = c.dispute.resolved ? "confirmed" : "disputed";
      const id = next("contributions");
      add("contributions", {
        contribution_id: id,
        team_id: teamId,
        user_id: c.by,
        task_id: c.task ?? null,
        description: c.text,
        hours_spent: c.hours,
        completion_date: date(c.daysAgo),
        verification_status: status,
        logged_date: at(c.daysAgo, 18),
      });
      c.confirms.forEach((who, i) =>
        add("verifications", { verification_id: next("verifications"), contribution_id: id, verifier_id: who, decision: "confirm", reason: null, decision_date: at(Math.max(c.daysAgo - 1, 0), 10 + i) }),
      );
      if (c.dispute) {
        const verificationId = next("verifications");
        add("verifications", { verification_id: verificationId, contribution_id: id, verifier_id: c.dispute.by, decision: "dispute", reason: c.dispute.reason, decision_date: at(c.daysAgo - 1, 12) });
        add("disputes", {
          dispute_id: next("disputes"),
          verification_id: verificationId,
          resolved_by_id: c.dispute.resolved ? professor : null,
          dispute_status: c.dispute.resolved ? "rejected" : "open",
          resolution_note: c.dispute.resolved ?? null,
          opened_date: at(c.daysAgo - 1, 12),
          resolved_date: c.dispute.resolved ? at(c.daysAgo - 3) : null,
        });
      }
    }
  };

  let inviteNo = 0;
  for (const team of roster.teams) {
    const teamId = next("teams");
    const memberIds = team.members.map((m) => uid(m.first, m.last));
    const inProgress = team.name === roster.scenarios.charterTeam;
    const notAgreed = inProgress ? team.members.filter((m) => m.role === "Developer").slice(-2).map(idOf) : [];
    const scrum = team.members.find((m) => m.role === "Scrum Master")!;
    const owner = team.members.find((m) => m.role === "Product Owner")!;

    add("teams", { team_id: teamId, project_id: projectId, team_name: team.name, channel_status: team.status, visibility: "private", creation_date: at(55) });
    for (const m of team.members) {
      const id = uid(m.first, m.last);
      add("invitations", {
        invitation_id: next("invitations"),
        team_id: teamId,
        invited_email: workspaceEmail(m.first, m.last, workspace),
        invite_token: `demo-${workspace}-${++inviteNo}`,
        invite_status: "accepted",
        date_received: at(54),
        accepted_date: at(53),
      });
      add("team_memberships", {
        membership_id: next("team_memberships"),
        team_id: teamId,
        user_id: id,
        access_level: "write",
        team_role: m.role,
        role_confirmed: 1,
        charter_agreed: notAgreed.includes(id) ? 0 : 1,
        joined_date: at(53),
      });
    }
    add("team_charters", {
      charter_id: next("team_charters"),
      team_id: teamId,
      team_goals: CHARTER.goals,
      expectations: CHARTER.expectations,
      created_date: at(52),
      completed_date: inProgress ? null : at(50),
      updated_by_id: uid(scrum.first, scrum.last),
      updated_date: inProgress ? at(3) : at(50),
      locked_date: inProgress ? null : at(50),
    });

    if (team.name === roster.scenarios.inviteTeam) {
      add("invitations", {
        invitation_id: next("invitations"),
        team_id: teamId,
        invited_email: workspaceEmail("New", "Student", workspace),
        invite_token: `demo-${workspace}-invite`,
        invite_status: "pending",
        date_received: at(1),
        accepted_date: null,
      });
    }

    if (team.name === roster.scenarios.reviewTeam) {
      const subjectMember = memberNamed(team, roster.scenarios.reviewMember)!;
      const studentMember = memberNamed(team, roster.scenarios.defaultStudent)!;
      const subject = idOf(subjectMember);
      const student = idOf(studentMember);
      const productOwner = idOf(owner);
      const [mateA, mateB] = team.members.filter((m) => m !== subjectMember && m !== studentMember && m !== owner).map(idOf);

      const backlog = addTask(teamId, productOwner, "Product backlog", date(35), "done");
      const prototype = addTask(teamId, student, "Clickable prototype", date(-5), "in_progress");
      addTask(teamId, mateA, "Final presentation deck", date(-28), "to_do");
      addTask(teamId, subject, "Prototype test plan", date(-6), "to_do");
      addTask(teamId, student, "Sprint 3 demo", date(-2), "to_do");
      addTask(teamId, null, "Usability test script", date(-12), "to_do");
      add("task_reassignments", {
        reassignment_id: next("task_reassignments"),
        task_id: prototype,
        from_user_id: subject,
        to_user_id: student,
        reassigned_by_id: professor,
        reassignment_reason: `Moved to ${studentMember.first} for this sprint to keep the prototype on schedule.`,
        reassigned_date: at(8),
      });

      addEntries(teamId, memberIds.length, [
        { by: subject, text: "Ran sprint planning and set the sprint goal", hours: 2.5, daysAgo: 38, confirms: [productOwner, student, mateA] },
        { by: productOwner, text: "Wrote and prioritized the product backlog", hours: 4, daysAgo: 34, task: backlog, confirms: [student, mateA, mateB] },
        { by: subject, text: "Wrote the sprint review notes", hours: 1.5, daysAgo: 29, confirms: [productOwner], dispute: { by: mateB, reason: "I think we wrote these notes together.", resolved: `Checked the doc history with the team. ${subjectMember.first} wrote them. Entry confirmed.` } },
        { by: subject, text: "Built the prototype login screen", hours: 5, daysAgo: 24, confirms: [], dispute: { by: student, reason: "I built this screen. The commit history shows my changes." } },
        { by: student, text: "Built the team dashboard screen", hours: 5, daysAgo: 20, confirms: [productOwner, mateA, mateB] },
        { by: mateA, text: "Designed the peer rating screen", hours: 3.5, daysAgo: 16, confirms: [productOwner, student, mateB] },
        { by: mateB, text: "Wrote the database migration", hours: 3, daysAgo: 12, confirms: [productOwner, student, mateA] },
        { by: productOwner, text: "Updated the backlog for sprint 3", hours: 1.5, daysAgo: 6, confirms: [student, mateA, mateB] },
        { by: student, text: "Connected the work log to the database", hours: 3, daysAgo: 5, task: prototype, confirms: [mateA] },
        { by: mateA, text: "Tested the app at phone width", hours: 2, daysAgo: 2, confirms: [productOwner] },
        { by: mateB, text: "Fixed date handling on the task board", hours: 1.5, daysAgo: 1, confirms: [mateA] },
      ]);
    } else {
      const devs = team.members.filter((m) => m.role === "Developer");
      const ownerId = uid(owner.first, owner.last);
      const backlog = addTask(teamId, ownerId, "Product backlog", date(36), "done");
      const lead = devs[0];
      const leadId = uid(lead.first, lead.last);
      addTask(teamId, leadId, "Working prototype", team.status === "finished" ? date(4) : date(-6), team.status === "finished" ? "done" : "in_progress");
      if (team.status !== "finished") addTask(teamId, null, "Usability test script", date(-10), "to_do");
      if (inProgress) addTask(teamId, ownerId, "Duplicate backlog item", date(-9), "to_do", notAgreed[notAgreed.length - 1]);

      const entries: Entry[] = [];
      team.members.forEach((m, i) => {
        const id = uid(m.first, m.last);
        const others = memberIds.filter((x) => x !== id);
        const needed = Math.floor(others.length / 2) + 1;
        const work = m.role === "Scrum Master" ? SCRUM_WORK : m.role === "Product Owner" ? OWNER_WORK : [DEV_WORK[(i * 2) % DEV_WORK.length], DEV_WORK[(i * 2 + 1) % DEV_WORK.length]];
        entries.push({ by: id, ...work[0], daysAgo: 36 - i * 2, task: m === owner ? backlog : undefined, confirms: others.slice(0, needed) });
        // The newest entry on a live team is still waiting for confirmation.
        const waiting = team.status === "published" && i === team.members.length - 1;
        entries.push({ by: id, ...work[1], daysAgo: 14 - i * 2, confirms: waiting ? others.slice(0, 1) : others.slice(0, needed) });
      });
      addEntries(teamId, memberIds.length, entries);
    }

    // ── Milestone 1 ratings ───────────────────────────────────────────────────
    const isReviewTeam = team.name === roster.scenarios.reviewTeam;
    const flagged = isReviewTeam ? idOf(memberNamed(team, roster.scenarios.reviewMember)!) : -1;
    const unrated = isReviewTeam ? idOf(memberNamed(team, roster.scenarios.defaultStudent)!) : -1;
    const ratings: ShareRating[] = [];
    memberIds.forEach((rater, i) => {
      if (rater === unrated) return; // The default student's ratings are left for the visitor to submit.
      // The flagged student splits evenly. Everyone else weighs the flagged student low.
      const weights = memberIds.map((ratee, j) => (rater === flagged ? 1 : ratee === flagged ? 2 : ratee === rater ? 5 : 4 + ((i + j) % 2)));
      const split = splitShares(weights);
      memberIds.forEach((ratee, j) => {
        ratings.push({ evaluatorId: rater, evaluateeId: ratee, shareBp: split[j] });
        add("contribution_shares", {
          share_id: next("contribution_shares"),
          milestone_id: milestone1,
          team_id: teamId,
          evaluator_id: rater,
          evaluatee_id: ratee,
          share_bp: split[j],
          comment: weights[j] === 5 && rater !== ratee ? "Reliable and easy to work with." : null,
          submission_date: at(26),
        });
      });
    });
    const names = Object.fromEntries(team.members.map((m) => [uid(m.first, m.last), key(m as DemoMember)]));
    for (const f of detectShareFlags(ratings, memberIds, names)) {
      add("integrity_flags", {
        flag_id: next("integrity_flags"),
        milestone_id: milestone1,
        team_id: teamId,
        rater_id: f.raterId,
        flag_type: f.type,
        flag_details: f.details,
        review_status: "open",
        flagged_date: at(26),
      });
    }
  }

  // Parents before children, so foreign keys hold.
  return [
    "users",
    "courses",
    "projects",
    "milestones",
    "teams",
    "invitations",
    "team_memberships",
    "team_charters",
    "tasks",
    "task_reassignments",
    "contributions",
    "verifications",
    "disputes",
    "evaluations",
    "contribution_shares",
    "integrity_flags",
  ].map((table) => ({ table, rows: rows[table] ?? [] }));
}
