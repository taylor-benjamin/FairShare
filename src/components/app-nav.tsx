import Link from "next/link";
import { LogoMark } from "./logo";
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
    <nav className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-x-4 gap-y-1 overflow-x-auto px-4 py-2 sm:px-6">
        <Link href="/" className="mr-1 flex shrink-0 items-center gap-1.5 font-semibold text-ink">
          <LogoMark size={26} className="rounded-md ring-1 ring-line" />
          FairShare
        </Link>
        <div className="flex shrink-0 items-center gap-3 text-small">
          {linksFor(user.role).map((l) => (
            <Link key={l.href} href={l.href} className="text-hint hover:text-primary">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3 text-small">
          <span className="hidden text-hint sm:inline">
            {user.firstName} {user.lastName} · {user.role}
          </span>
          <form action={logoutAction}>
            <button className="text-primary hover:underline">Log out</button>
          </form>
        </div>
      </div>
    </nav>
  );
}
