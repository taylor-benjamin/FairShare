"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TeamTabs({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <div className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 sm:px-4" aria-label="Team channel sections">
        {items.map((i) => {
          const active = path === i.href;
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 border-b-2 px-3 py-3 text-small ${active ? "border-primary text-primary" : "border-transparent text-hint hover:text-ink"}`}
            >
              {i.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
