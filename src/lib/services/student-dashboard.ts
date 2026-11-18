// Student Dashboard Service: one student's to-dos, teams and recent work across all their teams.
import "server-only";
import { studentDashboard, teams } from "../data/repo";
import type { SessionUser } from "../types";
import { authorizeTeam } from "./common";

export interface TodoItem {
  key: string;
  label: string;
  href: string;
  tone: "review" | "warning";
}

export async function getStudentDashboard(user: SessionUser | null) {
  if (!user || user.role !== "student") return null;

  const myTeams = await teams.forStudent(user.userId);
  // Every team still passes the single permission check before its data is shown.
  await Promise.all(myTeams.map((t) => authorizeTeam(user, "team.read", t.team_id)));

  const [review, ratings, totals, recent] = await Promise.all([
    studentDashboard.awaitingMyReview(user.userId),
    studentDashboard.ratingsDue(user.userId),
    studentDashboard.myTotals(user.userId),
    studentDashboard.myRecent(user.userId),
  ]);

  const reviewBy = new Map(review.map((r) => [r.team_id, r.n]));
  const totalsBy = new Map(totals.map((r) => [r.team_id, r]));
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
  for (const t of myTeams) {
    if (t.channel_status === "published" && !(t.role_confirmed && t.team_role)) {
      todos.push({ key: `role-${t.team_id}`, label: `Set your role in the charter${inTeam(t.team_name)}`, href: `/teams/${t.team_id}/charter`, tone: "warning" });
    }
    if (t.channel_status === "published" && t.has_charter && !t.charter_agreed) {
      todos.push({ key: `agree-${t.team_id}`, label: `Agree to the team charter${inTeam(t.team_name)}`, href: `/teams/${t.team_id}/charter`, tone: "warning" });
    }
  }

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
