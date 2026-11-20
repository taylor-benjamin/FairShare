"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TeamTabs({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <nav
        className="pill-track grid w-full sm:inline-flex sm:w-auto"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        aria-label="Team channel sections"
      >
        {items.map((i) => {
          const active = path === i.href;
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className="pill inline-flex items-center justify-center gap-1.5 !px-1 sm:!px-4"
            >
              {active && <span aria-hidden className="hidden size-1.5 rounded-full bg-secondary sm:inline" />}
              {i.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
