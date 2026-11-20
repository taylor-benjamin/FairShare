import Link from "next/link";
import type { ReactNode } from "react";
import { resolveDisputeAction, reviewFlagAction } from "@/app/actions/instructor";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Chip, Field, formatDate, formatHours, HeaderBar, Page, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { disputeQueue } from "@/lib/services/contribution-service";
import { flagQueue } from "@/lib/services/peer-evaluation";

export const metadata = { title: "Reviews" };

const flagLabel = { identical_scores: "Same score for everyone", reciprocal_scores: "Rated each other unusually high" };

export default async function ReviewsPage() {
  const user = await requireUser(["instructor"]);
  const [disputes, flags] = await Promise.all([disputeQueue(user), flagQueue(user)]);

  return (
    <>
      <HeaderBar title="Needs your review" subtitle="Disputed work and unusual rating patterns, oldest first" crumbs={[{ href: "/instructor", label: "Dashboard" }]} />
      <Page>
        <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <Panel title="Disputed entries" tone="disputed" count={disputes.open.length} empty="No open disputes.">
              {disputes.open.map((d) => (
                <li key={d.dispute_id} className="px-4 py-4 sm:px-5">
                  <p className="text-small text-hint">
                    <Link href={`/instructor/teams/${d.team_id}`} className="link">
                      {d.team_name}
                    </Link>{" "}
                    · Section {d.section_number} · disputed by {d.disputer_name} on {formatDate(d.opened_date)}
                  </p>
                  <p className="mt-1.5 text-ink">{d.description}</p>
                  <p className="text-small text-hint">
                    {d.author_name} · {formatDate(d.completion_date)}
                    {d.hours_spent !== null && ` · ${formatHours(d.hours_spent)}`}
                  </p>
                  {d.reason && <p className="mt-1 text-small text-disputed">Reason: {d.reason}</p>}
                  <ActionForm action={resolveDisputeAction.bind(null, d.dispute_id)} className="mt-3 space-y-2">
                    <Field label="Your note to the team" htmlFor={`note-${d.dispute_id}`}>
                      <input id={`note-${d.dispute_id}`} name="note" maxLength={255} placeholder="Required. The team sees this" className="field-input" />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <SubmitButton variant="dispute" small name="resolution" value="upheld" pendingText="Saving…">
                        Uphold dispute
                      </SubmitButton>
                      <SubmitButton variant="confirm" small name="resolution" value="rejected" pendingText="Saving…">
                        Reject dispute
                      </SubmitButton>
                    </div>
                  </ActionForm>
                </li>
              ))}
            </Panel>
            <p className="px-1 text-small text-hint">Uphold a dispute to remove the credit, or reject it to confirm the entry.</p>
            {disputes.resolved.length > 0 && (
              <History title="Recently resolved" count={disputes.resolved.length}>
                {disputes.resolved.map((d) => (
                  <li key={d.dispute_id} className="px-4 py-3 text-small sm:px-5">
                    <span className="font-semibold">{d.team_name}</span> · {d.author_name}: “{d.description}” ·{" "}
                    <span className={d.dispute_status === "upheld" ? "text-disputed" : "text-confirmed"}>{d.dispute_status}</span>
                    {d.resolution_note && <span className="block text-hint">{d.resolution_note}</span>}
                  </li>
                ))}
              </History>
            )}
          </div>

          <div className="space-y-3">
            <Panel title="Unusual rating patterns" tone="primary" count={flags.open.length} empty="No open flags.">
              {flags.open.map((f) => (
                <li key={f.flag_id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-small text-hint">
                      <Link href={`/instructor/teams/${f.team_id}`} className="link">
                        {f.team_name}
                      </Link>{" "}
                      · {f.milestone_name}
                    </p>
                    <Chip tone="review">{flagLabel[f.flag_type]}</Chip>
                  </div>
                  <p className="mt-1.5 text-ink">{f.flag_details}</p>
                  <ActionForm action={reviewFlagAction.bind(null, f.flag_id)} className="mt-3 flex flex-wrap gap-2">
                    <SubmitButton variant="secondary" small name="status" value="dismissed" pendingText="Saving…">
                      Dismiss
                    </SubmitButton>
                    <SubmitButton variant="primary" small name="status" value="confirmed" pendingText="Saving…">
                      Confirm
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </Panel>
            <p className="px-1 text-small text-hint">A flag isn&apos;t proof. Dismiss any that look fine.</p>
            {flags.reviewed.length > 0 && (
              <History title="Recently reviewed" count={flags.reviewed.length}>
                {flags.reviewed.map((f) => (
                  <li key={f.flag_id} className="px-4 py-3 text-small sm:px-5">
                    <span className="font-semibold">{f.team_name}</span>: {f.flag_details} · {f.review_status}
                  </li>
                ))}
              </History>
            )}
          </div>
        </div>
      </Page>
    </>
  );
}

/** A folded card with past items, opened on demand. */
function History({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <details className="card overflow-hidden">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 font-semibold">
          {title}
          <span className="rounded-full bg-wash px-2 py-0.5 text-small font-normal text-hint">{count}</span>
        </span>
        <span className="text-small text-primary">Show</span>
      </summary>
      <ul className="divide-y divide-line border-t border-line">{children}</ul>
    </details>
  );
}
