"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Top-nav links as pills; the current section gets a soft blue pill. */
export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  // Longest matching prefix wins, so /instructor/reviews doesn't also light up /instructor.
  const active = links
    .filter((l) => path === l.href || path.startsWith(l.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <div className="flex shrink-0 items-center gap-1 text-small">
      {links.map((l) => {
        const on = l.href === active;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 transition duration-200 ${on ? "bg-primary-soft font-semibold text-primary-dark" : "text-hint hover:bg-wash hover:text-ink"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
