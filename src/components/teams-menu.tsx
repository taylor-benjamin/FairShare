"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface NavTeam {
  teamId: number;
  name: string;
  /** e.g. "Semester Group Project · MGT 3200 Section 2" */
  context: string;
}

/** "My teams ▾" in the top bar for students. Lists every team; the one you're on is highlighted. */
export function TeamsMenu({ teams }: { teams: NavTeam[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = teams.find((t) => path === `/teams/${t.teamId}` || path.startsWith(`/teams/${t.teamId}/`));

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative text-small">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition duration-200 ${
          current ? "bg-primary-soft font-semibold text-primary-dark" : open ? "bg-wash text-ink" : "text-hint hover:bg-wash hover:text-ink"
        }`}
      >
        My teams
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={`size-3.5 transition ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute top-full left-0 z-30 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-(--radius-card) border border-line bg-surface p-1.5 shadow-(--shadow-lift)">
          {teams.map((t) => {
            const on = t.teamId === current?.teamId;
            return (
              <Link
                key={t.teamId}
                href={`/teams/${t.teamId}`}
                role="menuitem"
                aria-current={on ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition ${on ? "bg-primary-tint" : "hover:bg-wash"}`}
              >
                <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${on ? "bg-secondary" : "bg-line"}`} />
                <span className="min-w-0">
                  <span className={`block truncate text-ink ${on ? "font-semibold" : ""}`}>{t.name}</span>
                  <span className="block text-hint">{t.context}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
