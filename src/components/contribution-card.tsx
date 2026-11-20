// Contribution card (Milestone 2 §4.3): colored left edge + status chip; pending / confirmed / disputed.
import type { ReactNode } from "react";
import { Chip, formatDate, formatHours } from "./ui";
import { verifyAction } from "@/app/actions/team";
import { VerifyControls } from "./verify-controls";

export interface CardData {
  contribution_id: number;
  team_id: number;
  authorShort: string;
  description: string;
  hours_spent: number | null;
  completion_date: string;
  verification_status: "pending" | "confirmed" | "disputed";
  task_title: string | null;
  dispute_reason: string | null;
  dispute_status: string | null;
  confirm_count?: number;
  confirmsNeeded?: number;
  canVerify?: boolean;
  myDecision?: string | null;
  isMine?: boolean;
}

const edge = { pending: "border-l-primary", confirmed: "border-l-confirmed", disputed: "border-l-disputed" };

/** The status chip for an entry: confirmed, disputed, needs your review, or waiting with the confirm count. */
export function contributionChip(c: CardData): ReactNode {
  if (c.verification_status === "confirmed") return <Chip tone="confirmed">Confirmed</Chip>;
  if (c.verification_status === "disputed") return <Chip tone="disputed">{c.dispute_status === "upheld" ? "Dispute upheld" : "Disputed"}</Chip>;
  if (c.canVerify) return <Chip tone="review">Needs your review</Chip>;
  return (
    <Chip tone="pending">
      {c.isMine ? "Waiting" : c.myDecision ? "You confirmed" : "Pending"}
      {c.confirmsNeeded ? ` · ${c.confirm_count ?? 0}/${c.confirmsNeeded}` : ""}
    </Chip>
  );
}

export function ContributionCard({ c, footer }: { c: CardData; footer?: ReactNode }) {
  const chip = contributionChip(c);
  return (
    <article className={`card border-l-4 p-4 shadow-[0_1px_2px_rgba(31,41,51,0.04)] ${edge[c.verification_status]}`} aria-label={`${c.authorShort}: ${c.description}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-small text-hint">
          <span className="text-ink">{c.authorShort}</span> · {formatDate(c.completion_date)}
          {c.hours_spent !== null && <> · {formatHours(c.hours_spent)}</>}
        </p>
        {chip}
      </div>
      <p className="mt-1 text-body">{c.description}</p>
      {c.task_title && <p className="mt-0.5 text-small text-hint">Task: {c.task_title}</p>}
      {c.dispute_reason && (c.verification_status === "disputed" || c.dispute_status) && (
        <p className="mt-1 text-small text-disputed">Reason: {c.dispute_reason}</p>
      )}
      {c.dispute_status === "rejected" && <p className="mt-0.5 text-small text-confirmed">Instructor reviewed the dispute and confirmed this entry.</p>}
      {c.dispute_status === "upheld" && <p className="mt-0.5 text-small text-hint">Instructor upheld the dispute; this entry doesn&apos;t count.</p>}
      {c.canVerify && <VerifyControls action={verifyAction.bind(null, c.contribution_id, c.team_id)} contributionId={c.contribution_id} />}
      {footer}
    </article>
  );
}
