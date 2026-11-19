"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AppNotification } from "@/lib/types";

const dot: Record<AppNotification["tone"], string> = {
  overdue: "bg-disputed",
  deadline: "bg-warning",
  review: "bg-primary",
  warning: "bg-secondary",
};

/** Bell in the top bar. The badge counts what needs the user; the panel lists it, each item linking to where it's handled. */
export function NotificationBell({ items }: { items: AppNotification[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const n = items.length;

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
    // Not positioned on phones, so the panel spans the sticky top bar; anchored to the bell from sm up.
    <div ref={ref} className="sm:relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={n > 0 ? `Notifications, ${n} new` : "Notifications"}
        aria-expanded={open}
        aria-controls="notifications-panel"
        className={`relative grid size-10 place-items-center rounded-full text-ink transition hover:bg-wash ${open ? "bg-wash" : ""}`}
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-[22px]">
          <path d="M6 9a6 6 0 1 1 12 0c0 4.5 1.5 6.5 2.5 7.5h-17C4.5 15.5 6 13.5 6 9Z" />
          <path d="M10 20a2.2 2.2 0 0 0 4 0" />
        </svg>
        {n > 0 && (
          <span aria-hidden className="absolute top-1 right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-secondary px-1 text-[11px] leading-none font-semibold text-white ring-2 ring-surface">
            {n > 9 ? "9+" : n}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notifications-panel"
          role="region"
          aria-label="Notifications"
          className="absolute inset-x-2 top-full z-30 mt-2 overflow-hidden rounded-(--radius-card) border border-line bg-surface shadow-(--shadow-lift) sm:inset-x-auto sm:right-0 sm:w-96"
        >
          <p className="border-b border-line px-4 py-3 font-semibold">Notifications</p>
          {n === 0 ? (
            <p className="px-4 py-6 text-center text-hint">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-[min(70vh,28rem)] divide-y divide-line overflow-y-auto">
              {items.map((it) => (
                <li key={it.key}>
                  <Link href={it.href} onClick={() => setOpen(false)} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-primary-tint/60">
                    <span aria-hidden className={`mt-2 size-2 shrink-0 rounded-full ${dot[it.tone]}`} />
                    <span className="min-w-0">
                      <span className="block break-words text-ink">{it.label}</span>
                      {it.detail && <span className={`block text-small ${it.tone === "overdue" ? "text-disputed" : "text-hint"}`}>{it.detail}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
