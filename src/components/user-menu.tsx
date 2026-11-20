"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/actions/auth";

/** Avatar and name in the top bar; opens a small menu with Log out. Shown from sm up (phones use the ☰ menu). */
export function UserMenu({ firstName, lastName, role }: { firstName: string; lastName: string; role: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
    <div ref={ref} className="relative hidden sm:block">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-2.5 rounded-full py-1 pr-2.5 pl-1 transition hover:bg-wash ${open ? "bg-wash" : ""}`}
      >
        <span aria-hidden className="grid size-8 place-items-center rounded-full bg-primary text-[12px] font-semibold text-white">
          {firstName[0]}
          {lastName[0]}
        </span>
        <span className="text-left leading-tight">
          <span className="block text-small text-ink">
            {firstName} {lastName}
          </span>
          <span className="block text-[12px] text-hint capitalize">{role}</span>
        </span>
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={`size-4 text-hint transition ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-30 mt-2 w-48 rounded-(--radius-card) border border-line bg-surface p-1.5 shadow-(--shadow-lift)">
          <form action={logoutAction}>
            <button role="menuitem" className="w-full rounded-xl px-3 py-2.5 text-left text-ink transition hover:bg-wash">
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
