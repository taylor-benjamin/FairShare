import Link from "next/link";
import { LogoMark } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";
import { NewMenu } from "./new-menu";
import { NotificationBell } from "./notification-bell";
import { TeamsMenu, type NavTeam } from "./teams-menu";
import { UserMenu } from "./user-menu";
import { projectsAwaitingClassList } from "@/lib/services/class-setup";
import { getNotifications } from "@/lib/services/notifications";
import { myTeams } from "@/lib/services/team-health";
import type { AppNotification, SessionUser } from "@/lib/types";

/**
 * Top-bar links. Students get Dashboard plus a "My teams" dropdown (TeamsMenu) listing every team,
 * even when there's only one, so the label never changes. The phone menu lists every team.
 */
const linksFor = (role: SessionUser["role"], teams: NavTeam[]) =>
  role === "instructor"
    ? [
        { href: "/instructor", label: "Dashboard" },
        { href: "/instructor/reviews", label: "Reviews" },
      ]
    : [{ href: "/teams", label: "Dashboard", exact: true }, ...teams.map((t) => ({ href: `/teams/${t.teamId}`, label: t.name }))];

/** Thin top navigation shared by every signed-in page. */
export async function AppNav({ user }: { user: SessionUser }) {
  // The bell is a convenience: if loading it fails, show the page anyway.
  let notifications: AppNotification[] = [];
  try {
    notifications = await getNotifications(user);
  } catch {}
  let awaitingClassList: Awaited<ReturnType<typeof projectsAwaitingClassList>> = [];
  if (user.role === "instructor") {
    try {
      awaitingClassList = await projectsAwaitingClassList(user);
    } catch {}
  }
  let teams: NavTeam[] = [];
  if (user.role === "student") {
    try {
      teams = (await myTeams(user)).map((t) => ({ teamId: t.team_id, name: t.team_name, context: `${t.project_name} · ${t.course_code} Section ${t.section_number}` }));
    } catch {}
  }
  const links = linksFor(user.role, teams);
  const hasTeams = teams.length > 0;
  return (
    <nav className="sticky top-0 z-20 border-b border-line/70 bg-surface/85 backdrop-blur-md">
      <div className="flex w-full items-center gap-x-2 gap-y-1 px-4 py-2.5 sm:gap-x-4 sm:px-6 lg:px-8">
        <Link href="/" className="mr-1 flex shrink-0 items-center gap-2 font-semibold text-ink">
          <LogoMark size={30} className="rounded-lg ring-1 ring-line" />
          <span className="hidden sm:inline">
            Fair<span className="text-secondary">Share</span>
          </span>
        </Link>
        <div className="hidden items-center gap-1 sm:flex">
          <NavLinks links={hasTeams ? links.slice(0, 1) : links} />
          {hasTeams && <TeamsMenu teams={teams} />}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 text-small sm:gap-3">
          {user.role === "instructor" && <NewMenu awaitingClassList={awaitingClassList} />}
          <NotificationBell items={notifications} />
          <UserMenu firstName={user.firstName} lastName={user.lastName} role={user.role} />
          <MobileMenu links={links} name={`${user.firstName} ${user.lastName}`} role={user.role} />
        </div>
      </div>
    </nav>
  );
}
