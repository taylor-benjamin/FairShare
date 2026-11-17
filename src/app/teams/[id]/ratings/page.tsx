import { submitRatingsAction } from "@/app/actions/team";
import { handlePageError } from "@/components/access-denied";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Chip, EmptyState, formatDate, Notice, Page } from "@/components/ui";
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
  const { milestones, teammates, anonymous } = data;

  return (
    <Page narrow>
      <h2 className="text-heading">Peer ratings</h2>
      <p className="mt-1 text-small text-hint">
        {anonymous
          ? "Your ratings are anonymous. Teammates never see who rated them or what you gave anyone else. Only your instructor sees individual ratings."
          : "Only your instructor sees the full set of ratings. Teammates see the ratings they received, with your name."}
      </p>

      <div className="mt-6 space-y-6">
        {milestones.length === 0 && <EmptyState title="No milestones yet">Your instructor hasn&apos;t added any milestones.</EmptyState>}
        {milestones.map((m) => (
          <section key={m.milestone_id} className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{m.milestone_name}</h3>
              {m.milestone_status === "open" ? (
                <Chip tone="pending">Opens after {formatDate(m.due_date)}</Chip>
              ) : m.submitted ? (
                <Chip tone="confirmed">Submitted</Chip>
              ) : (
                <Chip tone="review">Ready to rate</Chip>
              )}
            </div>

            {m.milestone_status === "open" && <p className="mt-2 text-small text-hint">Ratings open once your instructor marks this milestone complete.</p>}

            {m.submitted && (
              <ul className="mt-3 space-y-1 text-small">
                {m.myRatings.map((r) => {
                  const mate = teammates.find((t) => t.user_id === r.evaluatee_id);
                  return (
                    <li key={r.evaluation_id} className="flex justify-between">
                      <span>
                        {mate?.first_name} {mate?.last_name}
                      </span>
                      <span className="text-hint">You gave {r.score}/5</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {m.milestone_status === "completed" && !m.submitted && (
              <ActionForm action={submitRatingsAction.bind(null, teamId, m.milestone_id)} className="mt-4 space-y-5">
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
                    <input id={`comment_${t.user_id}`} name={`comment_${t.user_id}`} placeholder="Optional comment for your instructor" maxLength={1000} className="field-input text-small" />
                  </fieldset>
                ))}
                <p className="text-small text-hint">1 = didn&apos;t contribute · 3 = met expectations · 5 = outstanding</p>
                <SubmitButton full pendingText="Submitting…">
                  Submit ratings
                </SubmitButton>
              </ActionForm>
            )}
          </section>
        ))}
      </div>

      {teammates.length === 0 && (
        <div className="mt-4">
          <Notice>You&apos;re the only member of this team so far, so there&apos;s no one to rate yet.</Notice>
        </div>
      )}
    </Page>
  );
}
