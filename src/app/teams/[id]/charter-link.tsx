"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The team charter's button on the team banner, with its status (e.g. "2 of 4 agreed"). */
export function CharterLink({ href, label, done }: { href: string; label: string; done: boolean }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group flex shrink-0 flex-col items-end gap-1 rounded-2xl px-3.5 py-2 text-right ring-1 transition-colors duration-200 sm:px-4 ${
        active ? "bg-white text-primary-dark ring-white" : "bg-white/15 text-white ring-white/30 hover:bg-white/25"
      }`}
    >
      <span className="inline-flex items-center gap-1.5 text-small font-semibold">
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9 13h6M9 17h4" />
        </svg>
        Charter
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap opacity-90">
        <span aria-hidden className={`size-1.5 rounded-full ${done ? "bg-emerald-400" : "bg-secondary"}`} />
        {label}
      </span>
    </Link>
  );
}
