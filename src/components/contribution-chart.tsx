// "Contribution ratings" card: each student's self rating and peer rating on one track.
// Sits beside "Confirmed hours" on the instructor's team page, in the same order and on the same scale.
import { formatShare } from "@/lib/rules";
import { Panel } from "./ui";

export interface ContributionRow {
  id: number;
  name: string;
  selfBp: number | null;
  peerBp: number | null;
}

const pct = (bp: number | null) => (bp === null ? "None" : formatShare(bp));

const SelfMark = ({ className = "", style }: { className?: string; style?: React.CSSProperties }) => <span aria-hidden className={`size-4 rounded-full border-2 border-secondary ${className}`} style={style} />;
const PeerMark = ({ className = "", style }: { className?: string; style?: React.CSSProperties }) => <span aria-hidden className={`size-2.5 rounded-full bg-primary ${className}`} style={style} />;

export function ContributionChart({ rows, scaleBp }: { rows: ContributionRow[]; scaleBp: number }) {
  const at = (bp: number) => `${(bp / scaleBp) * 100}%`;
  const centered = "absolute top-1/2 -translate-x-1/2 -translate-y-1/2";
  return (
    <Panel
      title="Contribution ratings"
      tone="secondary"
      empty="No members yet."
      action={
        <span className="flex shrink-0 items-center gap-3 text-small text-hint">
          <span className="inline-flex items-center gap-1.5">
            <SelfMark className="inline-block" /> Self
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PeerMark className="inline-block" /> Peers
          </span>
        </span>
      }
    >
      {rows.map((r) => {
        const label = r.selfBp === null && r.peerBp === null ? "No ratings yet" : `Self ${pct(r.selfBp)} · Peers ${pct(r.peerBp)}`;
        const both = r.selfBp !== null && r.peerBp !== null;
        return (
          <li key={r.id} className="px-4 py-3 sm:px-5" title={`${r.name}: ${label}`}>
            <div className="flex items-baseline justify-between gap-3 text-small">
              <span className="min-w-0 truncate">{r.name}</span>
              <span className="shrink-0 text-hint tabular-nums">{label}</span>
            </div>
            <div className="relative mt-2 h-2 w-full rounded-full bg-wash" role="img" aria-label={`${r.name}: ${label}`}>
              {both && (
                <span
                  aria-hidden
                  className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-hint/60"
                  style={{ left: at(Math.min(r.selfBp!, r.peerBp!)), width: at(Math.abs(r.selfBp! - r.peerBp!)) }}
                />
              )}
              {r.peerBp !== null && <PeerMark className={centered} style={{ left: at(r.peerBp) }} />}
              {r.selfBp !== null && <SelfMark className={centered} style={{ left: at(r.selfBp) }} />}
            </div>
          </li>
        );
      })}
    </Panel>
  );
}
