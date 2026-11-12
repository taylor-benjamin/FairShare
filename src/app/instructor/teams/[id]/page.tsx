import Link from "next/link";
import { deleteTeamAction, finishTeamAction, makePublicAction, reassignAction, unpublishChannelAction } from "@/app/actions/instructor";
import { DangerZone } from "@/components/danger-zone";
import { handlePageError } from "@/components/access-denied";
import { ContributionCard } from "@/components/contribution-card";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ArrowIcon, Chip, EmptyState, Field, formatDate, formatHours, HeaderBar, Notice, Page } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getChannel } from "@/lib/services/contribution-service";
import { teamResults } from "@/lib/services/peer-evaluation";
import { getReassignments, teamSignals } from "@/lib/services/team-health";

export const metadata = { title: "Team" };

export default async function InstructorTeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ grade?: string }> }) {
  const user = await requireUser(["instructor"]);
  const teamId = Number((await params).id);
  const gradeParam = (await searchParams).grade;
  let channel, results, history, signal;
  try {
    [channel, results, history] = await Promise.all([
      getChannel(user, teamId),
      teamResults(user, teamId, gradeParam !== undefined && gradeParam !== "" ? Number(gradeParam) : null),
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
          <Chip tone={team.visibility === "public" ? "neutral" : team.channel_status === "published" ? "confirmed" : "pending"}>
            {team.visibility === "public" ? "Public, read-only" : team.channel_status === "published" ? "Active" : team.channel_status === "finished" ? "Finished" : "Draft"}
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

        {/* Contribution scores — the transparent formula */}
        <section className="mb-10">
          <h2 className="text-heading">Contribution scores</h2>
          <p className="mt-1 text-small text-hint">{results.formula.label}. Capped at {results.formula.MAX_PERCENT}%. Ratings from completed milestones only.</p>
          <form className="mt-3 flex items-end gap-2" method="get">
            <Field label="Team grade (0–100)" htmlFor="grade">
              <input id="grade" name="grade" type="number" min={0} max={100} step="0.5" defaultValue={results.teamGrade} className="field-input w-28" />
            </Field>
            <button className="rounded-lg border border-primary px-3 py-2.5 text-small font-semibold text-primary hover:bg-primary-soft">Recalculate</button>
          </form>
          <div className="mt-4 card overflow-x-auto">
            <table className="table-soft w-full min-w-[640px] text-left text-small">
              <thead className="bg-wash text-hint">
                <tr>
                  <th className="px-3 py-2">Member</th>
                  <th className="px-3 py-2">Avg rating</th>
                  <th className="px-3 py-2">The math</th>
                  <th className="px-3 py-2">Adjusted grade</th>
                  <th className="px-3 py-2">Confirmed work</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {results.rows.map((r) => (
                  <tr key={r.userId}>
                    <td className="px-3 py-2">
                      <span className="text-body">{r.name}</span>
                      {r.role && <span className="block text-hint">{r.role}</span>}
                    </td>
                    <td className="px-3 py-2">{r.memberAverage !== null ? `${r.memberAverage.toFixed(2)} (${r.ratingCount})` : "—"}</td>
                    <td className="px-3 py-2 font-mono text-[12px]">{r.result.explanation}</td>
                    <td className="px-3 py-2 text-body font-semibold">{r.result.adjustedGrade}</td>
                    <td className="px-3 py-2">
                      {formatHours(r.confirmedHours) || "0 h"} · {r.confirmedCount} confirmed
                      {(r.pendingCount > 0 || r.disputedCount > 0) && (
                        <span className="block text-hint">
                          {r.pendingCount} pending{r.disputedCount > 0 && <span className="text-disputed"> · {r.disputedCount} disputed</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-small text-hint">Team average rating: {results.teamAverage !== null ? results.teamAverage.toFixed(2) : "no ratings yet"}.</p>
        </section>

        <div className="grid gap-10 lg:grid-cols-2">
          {/* Peer ratings with names — instructor only */}
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
          {team.channel_status === "finished" && team.visibility === "private" && (
            <div className="mt-3">
              <p className="text-small text-hint">Share the finished work log with your whole school, read-only. Ratings, comments, and scores are never shown.</p>
              <ActionForm action={makePublicAction.bind(null, teamId)} className="mt-2">
                <SubmitButton variant="secondary" pendingText="Sharing…">
                  Make channel public
                </SubmitButton>
              </ActionForm>
            </div>
          )}
          {team.visibility === "public" && (
            <div className="mt-3">
              <Notice>This channel is public and read-only. Anyone signed in can see the work log; evaluations stay private.</Notice>
              <p className="mt-3 text-small text-hint">Take it out of the public list. The channel becomes private again; nothing is deleted.</p>
              <ActionForm action={unpublishChannelAction.bind(null, teamId)} className="mt-2">
                <SubmitButton variant="secondary" pendingText="Removing…">
                  Make private
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
                `The ${team.team_name} channel${team.visibility === "public" ? " (including its public page)" : ""}`,
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
