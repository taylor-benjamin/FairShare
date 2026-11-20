"use client";

import { usePathname, useRouter } from "next/navigation";

/** A small dropdown that keeps its choice in the URL (?name=value), e.g. a list filter. The first option clears it. Pages using it take no other query params. */
export function UrlSelect({ name, value, options, label }: { name: string; value: string; options: { value: string; label: string }[]; label: string }) {
  const router = useRouter();
  const path = usePathname();
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        router.replace(v === options[0].value ? path : `${path}?${name}=${encodeURIComponent(v)}`, { scroll: false });
      }}
      className="field-input w-auto py-1.5 pl-3 text-small"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
