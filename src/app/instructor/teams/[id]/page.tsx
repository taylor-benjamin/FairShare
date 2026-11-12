import Link from "next/link";
import { deleteTeamAction, finishTeamAction, reassignAction } from "@/app/actions/instructor";
import { DangerZone } from "@/components/danger-zone";
import { handlePageError } from "@/components/access-denied";
import { ContributionCard } from "@/components/contribution-card";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ArrowIcon, Chip, EmptyState, Field, formatDate, HeaderBar, Page } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getChannel } from "@/lib/services/contribution-service";
import { teamRatings } from "@/lib/services/peer-evaluation";
import { getReassignments, teamSignals } from "@/lib/services/team-health";

export const metadata = { title: "Team" };

export default async function InstructorTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["instructor"]);
  const teamId = Number((await params).id);
  let channel, results, history, signal;
  try {
    [channel, results, history] = await Promise.all([
      getChannel(user, teamId),
      teamRatings(user, teamId),
      getReassignments(user, teamId),
    ]);
    signal = (await teamSignals(user, channel.team.project_id)).find((s) => s.teamId === teamId);
  } catch (e) {
    return handlePageError(e);
  }
  const { team, feed, tasks, members } = channel;
  const assignedTasks = tasks.filter((t) => t.user_id !== null);

  return (
    <>
      <HeaderBar
        title={team.team_name}
        subtitle={`${team.project_name} · ${team.course_code} Section ${team.section_number}`}
        back={{ href: `/instructor/projects/${team.project_id}`, label: "Project" }}
      />
      <Page>
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Chip tone={team.channel_status === "published" ? "confirmed" : "pending"}>
            {team.channel_status === "published" ? "Active" : team.channel_status === "finished" ? "Finished" : "Draft"}
          </Chip>
          <Link href={`/teams/${teamId}`} className="link inline-flex items-center gap-1 text-small">
            Open the channel as students see it <ArrowIcon />
          </Link>
        </div>

        {signal?.needsAttention && (
          <div className="mb-6 rounded-(--radius-card) border border-primary/20 bg-primary-tint p-4 sm:p-5">
            <p className="font-semibold text-primary">{signal.headline}</p>
            <ul className="mt-1 list-disc pl-5 text-small">
              {signal.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="mt-2 text-small text-hint">
              Consider messaging the team or inviting them to office hours. If you agree to move work around, record it under “Reassign a task” below.
              {(signal.openDisputes > 0 || signal.openFlags > 0) && (
                <>
                  {" "}
                  <Link href="/instructor/reviews" className="link">
                    Review disputes and flags
                  </Link>
                </>
              )}
            </p>
          </div>
        )}

        <div className="grid gap-10 lg:grid-cols-2">
          {/* Peer ratings with names: instructor only */}
          <section>
            <h2 className="text-heading">Peer ratings</h2>
            <p className="mt-1 text-small text-hint">Only you can see who gave which rating.</p>
            {results.matrix.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="No completed milestones yet">Ratings open when you mark a milestone complete.</EmptyState>
              </div>
            ) : (
              results.matrix.map(({ milestone, ratings }) => (
                <div key={milestone.milestone_id} className="mt-4">
                  <p className="font-semibold">{milestone.milestone_name}</p>
                  {ratings.length === 0 ? (
                    <p className="text-small text-hint">No ratings submitted yet.</p>
                  ) : (
                    <ul className="mt-2 card divide-y divide-line overflow-hidden text-small">
                      {ratings.map((r, i) => (
                        <li key={i} className="px-3 py-2">
                          <div className="flex justify-between">
                            <span>
                              {r.from} → {r.to}
                            </span>
                            <span className="font-semibold">{r.score}/5</span>
                          </div>
                          {r.comment && <p className="text-hint">“{r.comment}”</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </section>

          {/* Task reassignment (P13) */}
          <section>
            <h2 className="text-heading">Reassign a task</h2>
            <p className="mt-1 text-small text-hint">After meeting the team, record who takes over. Future work on the task counts for the new owner.</p>
            {assignedTasks.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="No assigned tasks">The team hasn&apos;t assigned any tasks yet.</EmptyState>
              </div>
            ) : (
              <ActionForm action={reassignAction.bind(null, teamId)} resetOnSuccess className="card mt-3 space-y-3 p-4">
                <Field label="Task" htmlFor="taskId">
                  <select id="taskId" name="taskId" className="field-input">
                    {assignedTasks.map((t) => (
                      <option key={t.task_id} value={t.task_id}>
                        {t.task_title} ({t.owner_first} {t.owner_last})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Give it to" htmlFor="toUserId">
                  <select id="toUserId" name="toUserId" className="field-input">
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.first_name} {m.last_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Reason" htmlFor="reason" hint="The team sees this. e.g. “Agreed in office hours on Oct 14.”">
                  <input id="reason" name="reason" maxLength={255} className="field-input" />
                </Field>
                <SubmitButton pendingText="Saving…">Record reassignment</SubmitButton>
              </ActionForm>
            )}
            {history.length > 0 && (
              <ul className="mt-4 space-y-2">
                {history.map((r) => (
                  <li key={r.reassignment_id} className="rounded-xl bg-wash p-3.5 text-small">
                    <span className="font-semibold">{r.task_title}</span>: {r.from_name} → {r.to_name} · {formatDate(r.reassigned_date)}
                    <span className="block text-hint">{r.reassignment_reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Work log */}
        <section className="mt-10">
          <h2 className="text-heading">Work log</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {feed.length === 0 ? <EmptyState title="Nothing logged yet" /> : feed.map((c) => <ContributionCard key={c.contribution_id} c={{ ...c, canVerify: false }} />)}
          </div>
        </section>

        {/* Channel lifecycle (P17) */}
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="text-heading">Channel</h2>
          {team.channel_status === "published" && (
            <div className="mt-3">
              <p className="text-small text-hint">When the project is over, finish the channel. Students can still read it but can&apos;t log new work.</p>
              <ActionForm action={finishTeamAction.bind(null, teamId)} className="mt-2">
                <SubmitButton variant="secondary" pendingText="Finishing…">
                  Finish channel
                </SubmitButton>
              </ActionForm>
            </div>
          )}

          <div className="mt-8">
            <DangerZone
              action={deleteTeamAction.bind(null, teamId)}
              thing="team"
              name={team.team_name}
              consequences={[
                `The ${team.team_name} channel`,
                `Its work log (${feed.length} ${feed.length === 1 ? "entry" : "entries"}), confirmations and disputes`,
                "All peer ratings, comments and integrity flags for this team",
                "Its charter, tasks, reassignment history and unused invite links",
                `Team membership for ${members.length} ${members.length === 1 ? "student" : "students"}`,
              ]}
            />
          </div>
        </section>
      </Page>
    </>
  );
}
