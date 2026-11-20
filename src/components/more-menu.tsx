"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A "⋯" button that opens a small menu of secondary actions. Built on <details>, so it still opens
 * without JavaScript; with it, a click outside or Escape closes it. Put `.menu-item` buttons or forms inside.
 */
export function MoreMenu({ label = "More actions", children }: { label?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const d = ref.current;
      if (d?.open && !d.contains(e.target as Node)) d.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      const d = ref.current;
      if (e.key === "Escape" && d?.open) {
        d.open = false;
        d.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={ref} className="group relative shrink-0 open:z-30">
      <summary
        aria-label={label}
        title={label}
        className="grid size-8 cursor-pointer list-none place-items-center rounded-full text-hint transition group-open:bg-wash group-open:text-ink hover:bg-wash hover:text-ink [&::-webkit-details-marker]:hidden"
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="size-5">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </summary>
      <div className="absolute top-full right-0 z-20 mt-1 w-64 rounded-(--radius-card) border border-line bg-surface p-1.5 shadow-(--shadow-lift)">{children}</div>
    </details>
  );
}
