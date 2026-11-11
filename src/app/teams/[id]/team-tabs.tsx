"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TeamTabs({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
      <nav className="pill-track max-w-full overflow-x-auto" aria-label="Team channel sections">
        {items.map((i) => {
          const active = path === i.href;
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className="pill inline-flex items-center gap-1.5"
            >
              {active && <span aria-hidden className="size-1.5 rounded-full bg-secondary" />}
              {i.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
