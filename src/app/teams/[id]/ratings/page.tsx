import { submitRatingsAction } from "@/app/actions/team";
import { handlePageError } from "@/components/access-denied";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Chip, EmptyState, formatDate, Notice, Page } from "@/components/ui";

const headTone = { open: "", ready: "bg-primary-tint", submitted: "bg-confirmed-soft/45" } as const;
import { requireUser } from "@/lib/auth/session";
import { getRatingsPage } from "@/lib/services/peer-evaluation";

export const metadata = { title: "Peer ratings" };

const SCALE = [
  [1, "Didn't contribute"],
  [2, "Below expectations"],
  [3, "Met expectations"],
  [4, "Above expectations"],
  [5, "Outstanding"],
] as const;

export default async function RatingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const teamId = Number((await params).id);
  let data;
  try {
    data = await getRatingsPage(user, teamId);
  } catch (e) {
    return handlePageError(e);
  }
  const { teammates, anonymous } = data;
  // Milestones waiting for your ratings come first, then the rest in their usual order.
  const readyToRate = (m: (typeof data.milestones)[number]) => m.milestone_status === "completed" && !m.submitted;
  const milestones = [...data.milestones.filter(readyToRate), ...data.milestones.filter((m) => !readyToRate(m))];

  return (
    <Page>
      <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="space-y-4 sm:space-y-6">
        {milestones.length === 0 && <EmptyState title="No milestones yet">Your instructor hasn&apos;t added any milestones.</EmptyState>}
        {milestones.map((m) => (
          <section key={m.milestone_id} className="card overflow-hidden">
            <div className={`card-head flex-wrap ${headTone[m.milestone_status === "open" ? "open" : m.submitted ? "submitted" : "ready"]}`}>
              <h3 className="font-semibold">{m.milestone_name}</h3>
              {m.milestone_status === "open" ? (
                <Chip tone="pending">Opens after {formatDate(m.due_date)}</Chip>
              ) : m.submitted ? (
                <Chip tone="confirmed">Submitted</Chip>
              ) : (
                <Chip tone="review">Ready to rate</Chip>
              )}
            </div>

            {m.milestone_status === "open" && <p className="px-4 py-4 text-small text-hint sm:px-5">Ratings open once your instructor marks this milestone complete.</p>}

            {m.submitted && (
              <ul className="divide-y divide-line">
                {m.myRatings.map((r) => {
                  const mate = teammates.find((t) => t.user_id === r.evaluatee_id);
                  return (
                    <li key={r.evaluation_id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                      <span className="min-w-0">
                        {mate?.first_name} {mate?.last_name}
                        {mate?.team_role && <span className="text-hint"> · {mate.team_role}</span>}
                      </span>
                      <span className="shrink-0 text-small text-hint">
                        You gave <span className="font-semibold text-ink">{r.score}/5</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {m.milestone_status === "completed" && !m.submitted && (
              <ActionForm action={submitRatingsAction.bind(null, teamId, m.milestone_id)} className="space-y-5 p-4 sm:p-5">
                {teammates.map((t) => (
                  <fieldset key={t.user_id} className="space-y-2">
                    <legend className="font-semibold">
                      {t.first_name} {t.last_name}
                      {t.team_role && <span className="ml-1 text-small font-normal text-hint">· {t.team_role}</span>}
                    </legend>
                    <div className="grid grid-cols-5 gap-1.5" role="radiogroup">
                      {SCALE.map(([n, label]) => (
                        <label
                          key={n}
                          title={label}
                          className="flex cursor-pointer flex-col items-center rounded-lg border border-line py-2 text-center hover:border-primary has-checked:border-primary has-checked:bg-primary has-checked:text-white"
                        >
                          <input type="radio" name={`score_${t.user_id}`} value={n} required className="sr-only" />
                          <span className="text-body font-semibold">{n}</span>
                          <span className="hidden text-[11px] leading-tight sm:block">{label}</span>
                        </label>
                      ))}
                    </div>
                    <label htmlFor={`comment_${t.user_id}`} className="sr-only">
                      Comment for {t.first_name}
                    </label>
                    <input id={`comment_${t.user_id}`} name={`comment_${t.user_id}`} placeholder="Optional comment for your instructor" maxLength={1000} className="field-input" />
                  </fieldset>
                ))}
                <SubmitButton full pendingText="Submitting…">
                  Submit ratings
                </SubmitButton>
              </ActionForm>
            )}
          </section>
        ))}
      </div>

      <aside className="card overflow-hidden lg:sticky lg:top-20">
        <div className="card-head bg-secondary-tint">
          <h2 className="flex items-center gap-2">
            <span aria-hidden className="size-2 rounded-full bg-secondary" />
            How ratings work
          </h2>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <p className="text-small text-hint">
            {anonymous
              ? "Your ratings are anonymous. Teammates never see who rated them or what you gave anyone else. Only your instructor sees individual ratings."
              : "Only your instructor sees the full set of ratings. Teammates see the ratings they received, with your name."}
          </p>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {SCALE.map(([n, label]) => (
              <li key={n} className="flex items-center gap-3 px-3 py-2 text-small">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-primary-dark">{n}</span>
                {label}
              </li>
            ))}
          </ul>
          <p className="text-small text-hint">Ratings open when your instructor marks a milestone complete. Rate based on the work you saw, and check the team&apos;s confirmed hours on Log &amp; Verify.</p>
        </div>
      </aside>
      </div>

      {teammates.length === 0 && (
        <div className="mt-4">
          <Notice>You&apos;re the only member of this team so far, so there&apos;s no one to rate yet.</Notice>
        </div>
      )}
    </Page>
  );
}
