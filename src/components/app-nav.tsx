import Link from "next/link";
import { LogoMark } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";
import { NewMenu } from "./new-menu";
import { NotificationBell } from "./notification-bell";
import { logoutAction } from "@/app/actions/auth";
import { projectsAwaitingClassList } from "@/lib/services/class-setup";
import { getNotifications } from "@/lib/services/notifications";
import type { AppNotification, SessionUser } from "@/lib/types";

const linksFor = (role: SessionUser["role"]) =>
  role === "instructor"
    ? [
        { href: "/instructor", label: "Dashboard" },
        { href: "/instructor/reviews", label: "Reviews" },
      ]
    : [{ href: "/teams", label: "Dashboard" }];

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
  return (
    <nav className="sticky top-0 z-20 border-b border-line/70 bg-surface/85 backdrop-blur-md">
      <div className="flex w-full items-center gap-x-2 gap-y-1 px-4 py-2.5 sm:gap-x-4 sm:px-6 lg:px-8">
        <Link href="/" className="mr-1 flex shrink-0 items-center gap-2 font-semibold text-ink">
          <LogoMark size={30} className="rounded-lg ring-1 ring-line" />
          <span className="hidden sm:inline">
            Fair<span className="text-secondary">Share</span>
          </span>
        </Link>
        <div className="hidden sm:block">
          <NavLinks links={linksFor(user.role)} />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 text-small sm:gap-3">
          {user.role === "instructor" && <NewMenu awaitingClassList={awaitingClassList} />}
          <NotificationBell items={notifications} />
          <span className="hidden items-center gap-2 sm:inline-flex">
            <span aria-hidden className="grid size-8 place-items-center rounded-full bg-primary text-[12px] font-semibold text-white ring-2 ring-secondary/60 ring-offset-2">
              {user.firstName[0]}
              {user.lastName[0]}
            </span>
            <span className="leading-tight">
              <span className="block text-ink">
                {user.firstName} {user.lastName}
              </span>
              <span className="block text-[12px] text-hint capitalize">{user.role}</span>
            </span>
          </span>
          <form action={logoutAction} className="hidden sm:block">
            <button className="rounded-full px-2 py-1.5 whitespace-nowrap text-primary transition hover:bg-primary-tint sm:px-3">Log out</button>
          </form>
          <MobileMenu links={linksFor(user.role)} name={`${user.firstName} ${user.lastName}`} role={user.role} />
        </div>
      </div>
    </nav>
  );
}
