"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const items = [
  { href: "/instructor/projects/new", label: "New project", hint: "For a class you already have" },
  { href: "/instructor/projects/new?class=new", label: "New class", hint: "Add a course or section" },
];

type AwaitingProject = { project_id: number; project_name: string; course_code: string; section_number: string };

/**
 * Instructor's "New project" pill. Its dropdown arrow adds "New class" and, for each project
 * that has no teams yet, "Upload class list".
 */
export function NewMenu({ awaitingClassList }: { awaitingClassList: AwaitingProject[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
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
    // Not positioned on phones, so the menu spans the sticky top bar; anchored to the button from sm up.
    <div ref={ref} className="sm:relative">
      <div className="inline-flex items-stretch rounded-full bg-primary font-semibold text-white shadow-[0_4px_14px_rgb(37_99_235/0.25)]">
        <Link
          href="/instructor/projects/new"
          aria-label="New project"
          className="inline-flex items-center gap-1.5 rounded-l-full py-1.5 pr-2 pl-3 transition hover:bg-primary-dark sm:pr-3 sm:pl-4"
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="size-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="hidden sm:inline">New project</span>
        </Link>
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="More new options"
          aria-haspopup="menu"
          aria-expanded={open}
          className={`grid place-items-center rounded-r-full border-l border-white/30 pr-2.5 pl-1.5 transition hover:bg-primary-dark ${open ? "bg-primary-dark" : ""}`}
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={`size-3.5 transition ${open ? "rotate-180" : ""}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {open && (
        <div role="menu" className="absolute inset-x-2 top-full z-30 mt-2 sm:inset-x-auto sm:right-0 sm:w-72 overflow-hidden rounded-(--radius-card) border border-line bg-surface p-1.5 shadow-(--shadow-lift)">
          {items.map((it) => (
            <Link key={it.href} href={it.href} role="menuitem" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 transition hover:bg-wash">
              <span className="block font-semibold text-ink">{it.label}</span>
              <span className="block text-small text-hint">{it.hint}</span>
            </Link>
          ))}
          {awaitingClassList.length > 0 && <div aria-hidden className="mx-2 my-1 border-t border-line" />}
          {awaitingClassList.map((p) => (
            <Link
              key={p.project_id}
              href={`/instructor/projects/${p.project_id}/roster`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2.5 transition hover:bg-wash"
            >
              <span className="flex items-center gap-2 font-semibold text-ink">
                Upload class list
                <span aria-hidden className="size-1.5 rounded-full bg-secondary" />
              </span>
              <span className="block truncate text-small text-hint">
                {p.project_name} · {p.course_code} Section {p.section_number}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
