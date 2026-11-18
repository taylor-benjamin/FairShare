"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/actions/auth";

/**
 * Phone navigation: a ☰ button in the sticky top bar that opens a full-width menu panel.
 * Hidden from the sm breakpoint up, where the regular top-bar links show instead.
 */
export function MobileMenu({ links, name, role }: { links: { href: string; label: string }[]; name: string; role: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const active = links.filter((l) => path === l.href || path.startsWith(l.href + "/")).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // Close on navigation and on Escape; stop the page behind from scrolling while open.
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="grid size-10 place-items-center rounded-full text-ink transition hover:bg-wash"
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="size-6">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop below the bar; tapping it closes the menu. (Absolute, because the bar's blur makes `fixed` relative to the bar.) */}
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-x-0 top-full z-10 h-[100dvh] bg-ink/30" />
          <div id="mobile-menu" className="absolute inset-x-0 top-full z-20 border-b border-line bg-surface shadow-(--shadow-lift)">
            <nav aria-label="Main" className="flex flex-col p-2">
              {links.map((l) => {
                const on = l.href === active;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={on ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 rounded-xl px-4 py-3.5 text-body transition ${on ? "bg-primary-soft font-semibold text-primary-dark" : "text-ink hover:bg-wash"}`}
                  >
                    {on && <span aria-hidden className="size-1.5 rounded-full bg-secondary" />}
                    {l.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{name}</span>
                <span className="block text-small text-hint capitalize">{role}</span>
              </span>
              <form action={logoutAction}>
                <button className="rounded-full border border-primary/40 px-4 py-2 font-semibold text-primary transition hover:bg-primary-tint">Log out</button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
