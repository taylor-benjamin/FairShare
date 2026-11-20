// One work log entry as a row inside a Panel: what was done, who and when, its status, and Confirm/Dispute when it's waiting on you.
import { verifyAction } from "@/app/actions/team";
import { contributionChip, type CardData } from "./contribution-card";
import { formatDate, formatHours } from "./ui";
import { VerifyControls } from "./verify-controls";

export function ActivityRow({ c }: { c: CardData }) {
  return (
    <li className="px-4 py-3.5 sm:px-5" aria-label={`${c.authorShort}: ${c.description}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-ink">{c.description}</p>
        {/* Rows waiting on you sit under a "Needs your review" heading, so they skip the chip. */}
        {!c.canVerify && contributionChip(c)}
      </div>
      <p className="mt-0.5 text-small text-hint">
        {c.authorShort} · {formatDate(c.completion_date)}
        {c.hours_spent !== null && ` · ${formatHours(c.hours_spent)}`}
        {c.task_title && ` · Task: ${c.task_title}`}
      </p>
      {c.dispute_reason && (c.verification_status === "disputed" || c.dispute_status) && <p className="mt-1 text-small text-disputed">Reason: {c.dispute_reason}</p>}
      {c.dispute_status === "rejected" && <p className="mt-0.5 text-small text-confirmed">Instructor reviewed the dispute and confirmed this entry.</p>}
      {c.dispute_status === "upheld" && <p className="mt-0.5 text-small text-hint">Instructor upheld the dispute; this entry doesn&apos;t count.</p>}
      {c.canVerify && <VerifyControls action={verifyAction.bind(null, c.contribution_id, c.team_id)} contributionId={c.contribution_id} />}
    </li>
  );
}
