import Link from "next/link";
import { LogoMark } from "./logo";
import { NavLinks } from "./nav-links";
import { logoutAction } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/types";

const linksFor = (role: SessionUser["role"]) =>
  role === "instructor"
    ? [
        { href: "/instructor", label: "Dashboard" },
        { href: "/instructor/reviews", label: "Reviews" },
      ]
    : [{ href: "/teams", label: "Dashboard" }];

/** Thin top navigation shared by every signed-in page. */
export function AppNav({ user }: { user: SessionUser }) {
  return (
    <nav className="sticky top-0 z-20 border-b border-line/70 bg-surface/85 backdrop-blur-md">
      <div className="flex w-full items-center gap-x-2 gap-y-1 px-4 py-2.5 sm:gap-x-4 sm:px-6 lg:px-8">
        <Link href="/" className="mr-1 flex shrink-0 items-center gap-2 font-semibold text-ink">
          <LogoMark size={30} className="rounded-lg ring-1 ring-line" />
          <span className="hidden sm:inline">
            Fair<span className="text-secondary">Share</span>
          </span>
        </Link>
        <NavLinks links={linksFor(user.role)} />
        <div className="ml-auto flex shrink-0 items-center gap-1.5 text-small sm:gap-3">
          {user.role === "instructor" && (
            <Link
              href="/instructor/projects/new"
              aria-label="New project"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-semibold text-white shadow-[0_4px_14px_rgb(37_99_235/0.25)] transition hover:bg-primary-dark sm:px-4"
            >
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="size-4">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="hidden sm:inline">New project</span>
            </Link>
          )}
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
          <form action={logoutAction}>
            <button className="rounded-full px-2 py-1.5 whitespace-nowrap text-primary transition hover:bg-primary-tint sm:px-3">Log out</button>
          </form>
        </div>
      </div>
    </nav>
  );
}
