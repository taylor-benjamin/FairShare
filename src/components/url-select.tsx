"use client";

import { usePathname, useRouter } from "next/navigation";

/** A small dropdown that keeps its choice in the URL (?name=value), e.g. a list filter. The first option clears it. `keep` holds other query params to preserve, like the open tab. */
export function UrlSelect({ name, value, options, label, keep = {} }: { name: string; value: string; options: { value: string; label: string }[]; label: string; keep?: Record<string, string> }) {
  const router = useRouter();
  const path = usePathname();
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        const query = new URLSearchParams(keep);
        if (v !== options[0].value) query.set(name, v);
        const qs = query.toString();
        router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
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
