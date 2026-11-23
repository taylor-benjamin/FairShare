// "Confirmed hours" card: one bar per teammate, so it's clear who is carrying the work.
// Used on the team's Log & Verify tab and the instructor's team page.
import { formatShare } from "@/lib/rules";
import { formatHours, Panel } from "./ui";

export interface HoursRow {
  id: number;
  name: string;
  hours: number;
  entries: number;
  /** The viewer: shown in bold with an orange bar. */
  me?: boolean;
}

/** With `scaleBp`, bars show each person's percent of the team's hours on that shared scale, to compare with the ratings chart. */
export function HoursPanel({ rows, scaleBp }: { rows: HoursRow[]; scaleBp?: number }) {
  const sorted = [...rows].sort((a, b) => b.hours - a.hours);
  const max = Math.max(1, ...sorted.map((r) => r.hours));
  const total = sorted.reduce((s, r) => s + r.hours, 0);
  const shareBp = (r: HoursRow) => (total > 0 ? Math.round((r.hours / total) * 10000) : 0);
  return (
    <Panel title="Confirmed hours" tone="confirmed" empty="No members yet.">
      {sorted.map((r) => (
        <li key={r.id} className="px-4 py-3 sm:px-5">
          <div className="flex items-baseline justify-between gap-3 text-small">
            <span className={`min-w-0 ${r.me ? "font-semibold" : ""} ${scaleBp ? "truncate" : ""}`}>
              {r.name}
              {r.me && " (you)"}
            </span>
            <span className={`shrink-0 tabular-nums ${r.hours === 0 ? "font-semibold text-disputed" : "text-hint"}`}>
              {formatHours(r.hours) || "0 h"} · {scaleBp ? formatShare(shareBp(r)) : `${r.entries} ${r.entries === 1 ? "entry" : "entries"}`}
            </span>
          </div>
          <div className="progress mt-2" role="img" aria-label={`${r.name}: ${formatHours(r.hours) || "0 h"} confirmed${scaleBp ? `, ${formatShare(shareBp(r))} of team hours` : ""}`}>
            <span className={r.me ? "bg-secondary" : "bg-primary"} style={{ width: `${scaleBp ? (shareBp(r) / scaleBp) * 100 : (r.hours / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </Panel>
  );
}

/**
 * One stacked bar showing each member's share of the team's confirmed hours, with names underneath.
 * Members with no confirmed hours are listed in red. For the instructor dashboard's team rows.
 */
export function ShareBar({ members }: { members: { userId: number; name: string; hours: number }[] }) {
  const total = members.reduce((s, m) => s + m.hours, 0);
  const shades = ["bg-primary", "bg-primary/70", "bg-primary/45", "bg-primary/25", "bg-primary/15"];
  return (
    <div className="min-w-0">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-wash" role="img" aria-label={members.map((m) => `${m.name} ${formatHours(m.hours) || "0 h"}`).join(", ")}>
        {total > 0 &&
          members.map((m, i) => (
            <span key={m.userId} className={`h-full ${shades[i % shades.length]} ${i > 0 ? "border-l-2 border-surface" : ""}`} style={{ width: `${(m.hours / total) * 100}%` }} />
          ))}
      </div>
      <p className="mt-1.5 text-small text-hint">
        {members.map((m, i) => (
          <span key={m.userId}>
            {i > 0 && " · "}
            <span className={m.hours === 0 ? "font-semibold text-disputed" : ""}>
              {m.name} {formatHours(m.hours) || "0 h"}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}
