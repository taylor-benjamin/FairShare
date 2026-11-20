// Student Dashboard Service: one student's to-dos, teams and recent work across all their teams.
import "server-only";
import { studentDashboard, teams } from "../data/repo";
import { addDaysIso, daysUntil, dueLabel } from "../rules";
import type { SessionUser } from "../types";
import { authorizeTeam } from "./common";

export interface TodoItem {
  key: string;
  label: string;
  href: string;
  tone: "review" | "warning";
}

/**
 * The student's teams and everything waiting on them (to confirm, to rate, delete requests, charter steps).
 * Shared by the dashboard's To do list and the notifications menu.
 */
export async function loadStudentTodos(user: SessionUser) {
  const myTeams = await teams.forStudent(user.userId);
  // Every team still passes the single permission check before its data is shown.
  await Promise.all(myTeams.map((t) => authorizeTeam(user, "team.read", t.team_id)));

  const [review, ratings, deleteRequests] = await Promise.all([
    studentDashboard.awaitingMyReview(user.userId),
    studentDashboard.ratingsDue(user.userId),
    studentDashboard.deleteRequestsForMe(user.userId),
  ]);

  const reviewBy = new Map(review.map((r) => [r.team_id, r.n]));
  const multiTeam = myTeams.length > 1;
  const inTeam = (name: string) => (multiTeam ? ` in ${name}` : "");

  const todos: TodoItem[] = [];
  for (const t of myTeams) {
    const n = reviewBy.get(t.team_id) ?? 0;
    if (n > 0) {
      todos.push({ key: `review-${t.team_id}`, label: `Confirm ${n} ${n === 1 ? "entry" : "entries"}${inTeam(t.team_name)}`, href: `/teams/${t.team_id}`, tone: "review" });
    }
  }
  for (const r of ratings) {
    const t = myTeams.find((x) => x.team_id === r.team_id);
    if (t) todos.push({ key: `rate-${r.team_id}-${r.milestone_id}`, label: `Rate your teammates for ${r.milestone_name}${inTeam(t.team_name)}`, href: `/teams/${t.team_id}/ratings`, tone: "review" });
  }
  for (const d of deleteRequests) {
    const t = myTeams.find((x) => x.team_id === d.team_id);
    if (t) todos.push({ key: `delete-${d.task_id}`, label: `${d.requester_first} asked to delete “${d.task_title}”${inTeam(t.team_name)}`, href: `/teams/${t.team_id}/tasks`, tone: "warning" });
  }
  for (const t of myTeams) {
    if (t.channel_status === "published" && !(t.role_confirmed && t.team_role)) {
      todos.push({ key: `role-${t.team_id}`, label: `Set your role in the charter${inTeam(t.team_name)}`, href: `/teams/${t.team_id}/charter`, tone: "warning" });
    }
    if (t.channel_status === "published" && t.has_charter && !t.charter_agreed) {
      todos.push({ key: `agree-${t.team_id}`, label: `Agree to the team charter${inTeam(t.team_name)}`, href: `/teams/${t.team_id}/charter`, tone: "warning" });
    }
  }

  return { myTeams, review, ratings, todos, multiTeam, reviewBy };
}

export async function getStudentDashboard(user: SessionUser | null) {
  if (!user || user.role !== "student") return null;

  const { myTeams, review, ratings, todos, multiTeam, reviewBy } = await loadStudentTodos(user);
  const today = new Date().toISOString().slice(0, 10);
  const until = addDaysIso(today, 14);
  const [totals, recent, taskDue, milestoneDue] = await Promise.all([
    studentDashboard.myTotals(user.userId),
    studentDashboard.myRecent(user.userId),
    studentDashboard.myTaskDeadlines(user.userId, until),
    studentDashboard.myMilestoneDeadlines(user.userId, today, until),
  ]);
  const teamName = (id: number) => myTeams.find((t) => t.team_id === id)?.team_name ?? "";
  // My unfinished tasks (overdue included) and the team's milestones, for the next two weeks.
  const deadlines = [
    ...taskDue.map((t) => ({ key: `task-${t.task_id}`, title: t.task_title, kind: "Task" as const, teamId: t.team_id, href: `/teams/${t.team_id}/tasks`, due: t.due_date })),
    ...milestoneDue.map((m) => ({ key: `ms-${m.team_id}-${m.milestone_id}`, title: m.milestone_name, kind: "Milestone" as const, teamId: m.team_id, href: `/teams/${m.team_id}`, due: m.due_date })),
  ]
    .filter((d) => teamName(d.teamId))
    .sort((a, b) => a.due.localeCompare(b.due))
    .map((d) => ({ ...d, teamName: teamName(d.teamId), when: dueLabel(d.due, today), overdue: daysUntil(d.due, today) < 0 }));
  const totalsBy = new Map(totals.map((r) => [r.team_id, r]));

  const teamCards = myTeams.map((t) => {
    const tot = totalsBy.get(t.team_id);
    return {
      teamId: t.team_id,
      teamName: t.team_name,
      context: `${t.project_name} · ${t.course_code} Section ${t.section_number}`,
      status: t.channel_status,
      role: t.team_role,
      toConfirm: reviewBy.get(t.team_id) ?? 0,
      ratingsDue: ratings.filter((r) => r.team_id === t.team_id).length,
      confirmedHours: tot?.confirmed_hours ?? 0,
    };
  });

  return {
    todos,
    deadlines,
    teams: teamCards,
    recent: recent.map((c) => ({
      id: c.contribution_id,
      teamName: c.team_name,
      description: c.description,
      hours: c.hours_spent,
      completionDate: c.completion_date,
      status: c.verification_status,
    })),
    stats: {
      toConfirm: review.reduce((s, r) => s + r.n, 0),
      ratingsDue: ratings.length,
      confirmedHours: totals.reduce((s, r) => s + (r.confirmed_hours ?? 0), 0),
      disputed: totals.reduce((s, r) => s + r.disputed, 0),
    },
    multiTeam,
  };
}
