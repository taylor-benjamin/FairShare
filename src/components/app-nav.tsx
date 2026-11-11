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
        { href: "/instructor/projects/new", label: "New project" },
        { href: "/public", label: "Public channels" },
      ]
    : role === "student"
      ? [
          { href: "/teams", label: "My teams" },
          { href: "/public", label: "Public channels" },
        ]
      : [{ href: "/public", label: "Public channels" }];

/** Thin top navigation shared by every signed-in page. */
export function AppNav({ user }: { user: SessionUser }) {
  return (
    <nav className="sticky top-0 z-20 border-b border-line/70 bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-x-4 gap-y-1 overflow-x-auto px-4 py-2.5 sm:px-6">
        <Link href="/" className="mr-1 flex shrink-0 items-center gap-2 font-semibold text-ink">
          <LogoMark size={30} className="rounded-lg ring-1 ring-line" />
          <span>
            Fair<span className="text-secondary">Share</span>
          </span>
        </Link>
        <NavLinks links={linksFor(user.role)} />
        <div className="ml-auto flex shrink-0 items-center gap-3 text-small">
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
            <button className="rounded-full px-3 py-1.5 text-primary transition hover:bg-primary-tint">Log out</button>
          </form>
        </div>
      </div>
    </nav>
  );
}
