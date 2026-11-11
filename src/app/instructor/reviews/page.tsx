import Link from "next/link";
import { resolveDisputeAction, reviewFlagAction } from "@/app/actions/instructor";
import { ContributionCard } from "@/components/contribution-card";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Chip, EmptyState, Field, formatDate, HeaderBar, Page } from "@/components/ui";
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
      <HeaderBar title="Needs your review" subtitle="Disputed work and unusual rating patterns, oldest first" back={{ href: "/instructor", label: "Dashboard" }} />
      <Page>
        <div className="grid gap-10 lg:grid-cols-2">
          <section>
            <h2 className="text-heading">Disputed entries</h2>
            <p className="mt-1 text-small text-hint">A teammate says this work log entry isn&apos;t accurate. Uphold the dispute to remove the credit, or reject it to confirm the entry.</p>
            <div className="mt-4 space-y-4">
              {disputes.open.length === 0 && <EmptyState title="No open disputes" />}
              {disputes.open.map((d) => (
                <div key={d.dispute_id}>
                  <p className="mb-1 text-small text-hint">
                    <Link href={`/instructor/teams/${d.team_id}`} className="link">
                      {d.team_name}
                    </Link>{" "}
                    · Section {d.section_number} · disputed by {d.disputer_name} on {formatDate(d.opened_date)}
                  </p>
                  <ContributionCard
                    c={{
                      contribution_id: d.contribution_id,
                      team_id: d.team_id,
                      authorShort: d.author_name,
                      description: d.description,
                      hours_spent: d.hours_spent,
                      completion_date: d.completion_date,
                      verification_status: "disputed",
                      task_title: null,
                      dispute_reason: d.reason,
                      dispute_status: "open",
                    }}
                    footer={
                      <ActionForm action={resolveDisputeAction.bind(null, d.dispute_id)} className="mt-3 space-y-2 border-t border-line pt-3">
                        <Field label="Your note to the team" htmlFor={`note-${d.dispute_id}`} hint="Required. e.g. “Checked the file history — Marcus built it.”">
                          <input id={`note-${d.dispute_id}`} name="note" maxLength={255} className="field-input" />
                        </Field>
                        <div className="flex flex-wrap gap-2">
                          <SubmitButton variant="dispute" small name="resolution" value="upheld" pendingText="Saving…">
                            Uphold dispute
                          </SubmitButton>
                          <SubmitButton variant="confirm" small name="resolution" value="rejected" pendingText="Saving…">
                            Reject — entry counts
                          </SubmitButton>
                        </div>
                      </ActionForm>
                    }
                  />
                </div>
              ))}
            </div>
            {disputes.resolved.length > 0 && (
              <details className="mt-6">
                <summary className="cursor-pointer text-small text-hint">Recently resolved ({disputes.resolved.length})</summary>
                <ul className="mt-2 space-y-2 text-small">
                  {disputes.resolved.map((d) => (
                    <li key={d.dispute_id} className="rounded-xl bg-wash p-3.5">
                      <span className="font-semibold">{d.team_name}</span> · {d.author_name}: “{d.description}” —{" "}
                      <span className={d.dispute_status === "upheld" ? "text-disputed" : "text-confirmed"}>{d.dispute_status}</span>
                      {d.resolution_note && <span className="block text-hint">{d.resolution_note}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section>
            <h2 className="text-heading">Unusual rating patterns</h2>
            <p className="mt-1 text-small text-hint">
              FairShare checks every set of ratings for two patterns. A flag isn&apos;t proof of anything — dismiss it if the ratings look reasonable to you.
            </p>
            <div className="mt-4 space-y-3">
              {flags.open.length === 0 && <EmptyState title="No open flags" />}
              {flags.open.map((f) => (
                <div key={f.flag_id} className="card border-l-4 border-l-primary p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-small text-hint">
                      <Link href={`/instructor/teams/${f.team_id}`} className="link">
                        {f.team_name}
                      </Link>{" "}
                      · {f.milestone_name}
                    </p>
                    <Chip tone="review">{flagLabel[f.flag_type]}</Chip>
                  </div>
                  <p className="mt-1">{f.flag_details}</p>
                  <ActionForm action={reviewFlagAction.bind(null, f.flag_id)} className="mt-3 flex flex-wrap gap-2">
                    <SubmitButton variant="secondary" small name="status" value="dismissed" pendingText="Saving…">
                      Looks fine — dismiss
                    </SubmitButton>
                    <SubmitButton variant="dispute" small name="status" value="confirmed" pendingText="Saving…">
                      Confirm problem
                    </SubmitButton>
                  </ActionForm>
                </div>
              ))}
            </div>
            {flags.reviewed.length > 0 && (
              <details className="mt-6">
                <summary className="cursor-pointer text-small text-hint">Recently reviewed ({flags.reviewed.length})</summary>
                <ul className="mt-2 space-y-2 text-small">
                  {flags.reviewed.map((f) => (
                    <li key={f.flag_id} className="rounded-xl bg-wash p-3.5">
                      {f.team_name}: {f.flag_details} — {f.review_status}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </div>
      </Page>
    </>
  );
}
