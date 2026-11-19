// Notifications: what a user should know about right now, for the bell in the top bar.
// Built fresh from existing data on each page load; nothing new is stored.
import "server-only";
import { disputes, flags, milestones, studentDashboard } from "../data/repo";
import { authorize } from "../permissions";
import { addDaysIso, daysUntil, dueLabel } from "../rules";
import type { AppNotification, SessionUser } from "../types";
import { loadStudentTodos } from "./student-dashboard";

/** How far ahead upcoming deadlines show up. */
export const DEADLINE_WINDOW_DAYS = 7;

/** Today's date (YYYY-MM-DD) in UTC, the same calendar the due dates are stored in. */
const utcToday = () => new Date().toISOString().slice(0, 10);

/**
 * Students: overdue tasks, then things waiting on them (confirm, rate, delete requests, charter),
 * then their disputed entries, then tasks and milestones due in the next week.
 * Instructors: disputes and rating flags to review, and milestones that are past due or due soon.
 */
export async function getNotifications(user: SessionUser | null, today: string = utcToday()): Promise<AppNotification[]> {
  if (!user) return [];
  const until = addDaysIso(today, DEADLINE_WINDOW_DAYS);
  return user.role === "instructor" ? instructorNotifications(user, today, until) : studentNotifications(user, today, until);
}

async function studentNotifications(user: SessionUser, today: string, until: string): Promise<AppNotification[]> {
  const { myTeams, todos, multiTeam } = await loadStudentTodos(user);
  const [taskDue, milestoneDue, disputed] = await Promise.all([
    studentDashboard.myTaskDeadlines(user.userId, until),
    studentDashboard.myMilestoneDeadlines(user.userId, today, until),
    studentDashboard.myOpenDisputes(user.userId),
  ]);
  const teamName = (id: number) => myTeams.find((t) => t.team_id === id)?.team_name;
  const withTeam = (text: string, teamId: number) => (multiTeam ? `${text} · ${teamName(teamId)}` : text);

  const overdue: AppNotification[] = [];
  const upcoming: (AppNotification & { due: string })[] = [];
  for (const t of taskDue) {
    if (!teamName(t.team_id)) continue;
    const item = {
      key: `task-${t.task_id}`,
      label: t.task_title,
      detail: withTeam(dueLabel(t.due_date, today), t.team_id),
      href: `/teams/${t.team_id}/tasks`,
    };
    if (daysUntil(t.due_date, today) < 0) overdue.push({ ...item, tone: "overdue" });
    else upcoming.push({ ...item, tone: "deadline", due: t.due_date });
  }
  for (const m of milestoneDue) {
    if (!teamName(m.team_id)) continue;
    upcoming.push({
      key: `milestone-${m.team_id}-${m.milestone_id}`,
      label: m.milestone_name,
      detail: withTeam(`Milestone ${dueLabel(m.due_date, today).toLowerCase()}`, m.team_id),
      href: `/teams/${m.team_id}`,
      tone: "deadline",
      due: m.due_date,
    });
  }
  upcoming.sort((a, b) => a.due.localeCompare(b.due));

  const disputedItems: AppNotification[] = disputed
    .filter((d) => teamName(d.team_id))
    .map((d) => ({
      key: `disputed-${d.contribution_id}`,
      label: `A teammate disputed “${d.description}”`,
      detail: withTeam("Your instructor will review it", d.team_id),
      href: `/teams/${d.team_id}`,
      tone: "warning",
    }));

  return [...overdue, ...todos, ...disputedItems, ...upcoming.map(({ due: _due, ...n }) => n)];
}

async function instructorNotifications(user: SessionUser, today: string, until: string): Promise<AppNotification[]> {
  authorize(user, "course.create"); // instructors only; every query is scoped to their own courses
  const [d, f, ms] = await Promise.all([
    disputes.openCountForInstructor(user.userId),
    flags.openCountForInstructor(user.userId),
    milestones.openDueForInstructor(user.userId, until),
  ]);
  const out: AppNotification[] = [];
  const nd = d?.n ?? 0;
  const nf = f?.n ?? 0;
  if (nd > 0) out.push({ key: "disputes", label: `${nd} disputed ${nd === 1 ? "entry" : "entries"} to review`, href: "/instructor/reviews", tone: "review" });
  if (nf > 0) out.push({ key: "flags", label: `${nf} rating ${nf === 1 ? "pattern" : "patterns"} to review`, href: "/instructor/reviews", tone: "review" });
  for (const m of ms) {
    const late = daysUntil(m.due_date, today) < 0;
    out.push({
      key: `milestone-${m.milestone_id}`,
      label: late ? `Mark ${m.milestone_name} complete` : m.milestone_name,
      detail: late ? `Was due ${shortDate(m.due_date)} · Ratings open once it's complete · ${m.project_name}` : `${dueLabel(m.due_date, today)} · ${m.project_name}`,
      href: `/instructor/projects/${m.project_id}`,
      tone: late ? "warning" : "deadline",
    });
  }
  return out;
}

const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
