import Link from "next/link";
import { addStudentAction, cancelInviteAction, deleteTeamAction, finishTeamAction, reassignAction, removeMemberAction, resendInviteAction } from "@/app/actions/instructor";
import { appUrl } from "@/app/actions/helpers";
import { ConfirmAction } from "@/components/confirm-action";
import { CopyLink } from "@/components/copy-link";
import { DangerZone } from "@/components/danger-zone";
import { handlePageError } from "@/components/access-denied";
import { ContributionCard } from "@/components/contribution-card";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ArrowIcon, Chip, EmptyState, Field, formatDate, HeaderBar, Page, PageTabs } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getTeamRoster } from "@/lib/services/class-setup";
import { getChannel } from "@/lib/services/contribution-service";
import { teamRatings } from "@/lib/services/peer-evaluation";
import { getTaskHistory, teamSignals } from "@/lib/services/team-health";
import { TaskHistoryList } from "@/components/task-history";

export const metadata = { title: "Team" };

const TABS = ["overview", "members", "ratings", "tasks", "settings"] as const;
type Tab = (typeof TABS)[number];

export default async function InstructorTeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser(["instructor"]);
  const teamId = Number((await params).id);
  const tabParam = (await searchParams).tab;
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "overview";
  let channel, results, history, signal, roster;
  try {
    [channel, results, history, roster] = await Promise.all([getChannel(user, teamId), teamRatings(user, teamId), getTaskHistory(user, teamId), getTeamRoster(user, teamId)]);
    signal = (await teamSignals(user, channel.team.project_id)).find((s) => s.teamId === teamId);
  } catch (e) {
    return handlePageError(e);
  }
  const { team, feed, tasks, members } = channel;
  const assignedTasks = tasks.filter((t) => t.user_id !== null);
  const base = await appUrl();
  const href = `/instructor/teams/${teamId}`;
  const confirmed = feed.filter((c) => c.verification_status === "confirmed").length;
  const disputed = feed.filter((c) => c.verification_status === "disputed").length;

  return (
    <>
      <HeaderBar
        title={team.team_name}
        subtitle={`${team.course_code} Section ${team.section_number}`}
        crumbs={[
          { href: "/instructor", label: "Dashboard" },
          { href: `/instructor/projects/${team.project_id}`, label: team.project_name },
        ]}
      />
      <Page>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Chip tone={team.channel_status === "published" ? "confirmed" : "pending"}>
            {team.channel_status === "published" ? "Active" : team.channel_status === "finished" ? "Finished" : "Draft"}
          </Chip>
          <Link href={`/teams/${teamId}`} className="link inline-flex items-center gap-1 text-small">
            View as a student <ArrowIcon />
          </Link>
        </div>

        <PageTabs
          base={href}
          active={tab}
          items={[
            { key: "overview", label: "Overview" },
            { key: "members", label: "Members", count: roster.members.length + roster.pending.length },
            { key: "ratings", label: "Ratings" },
            { key: "tasks", label: "Tasks", count: tasks.length },
            { key: "settings", label: "Settings" },
          ]}
        />

        {tab === "overview" && (
          <>
            {signal?.needsAttention ? (
              <div className="mb-6 rounded-(--radius-card) border border-primary/20 bg-primary-tint p-4 sm:p-5">
                <p className="font-semibold text-primary">Needs attention</p>
                <ul className="mt-1 list-disc pl-5 text-small">
                  {signal.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(signal.openDisputes > 0 || signal.openFlags > 0) && (
                    <Link href="/instructor/reviews" className="link inline-flex items-center gap-1 text-small">
                      Review disputes and flags <ArrowIcon />
                    </Link>
                  )}
                  {signal.inactive.length > 0 && (
                    <Link href={`${href}?tab=tasks`} className="link inline-flex items-center gap-1 text-small">
                      Reassign a task <ArrowIcon />
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-6 rounded-(--radius-card) border border-confirmed/20 bg-confirmed-soft/50 p-4 text-small">This team is on track.</div>
            )}
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-heading">Work log</h2>
              <p className="text-small text-hint">
                {feed.length} {feed.length === 1 ? "entry" : "entries"} · {confirmed} confirmed{disputed > 0 && ` · ${disputed} disputed`}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {feed.length === 0 ? <EmptyState title="Nothing logged yet" /> : feed.map((c) => <ContributionCard key={c.contribution_id} c={{ ...c, canVerify: false }} />)}
            </div>
          </>
        )}

        {tab === "members" && (
          <section className="max-w-3xl">
            <ul className="card divide-y divide-line overflow-hidden">
              {roster.members.length === 0 && roster.pending.length === 0 && <li className="px-4 py-3 text-small text-hint">No students yet.</li>}
              {roster.members.map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate">
                      {m.first_name} {m.last_name}
                      {m.team_role && <span className="text-small text-hint"> · {m.team_role}</span>}
                    </span>
                    <span className="block truncate text-small text-hint">{m.email}</span>
                  </span>
                  <ConfirmAction
                    action={removeMemberAction.bind(null, teamId, m.user_id)}
                    label="Remove"
                    pendingText="Removing…"
                    confirm={`Remove ${m.first_name} ${m.last_name} from ${team.team_name}? Their logged work stays in the log.`}
                  />
                </li>
              ))}
              {roster.pending.map((i) => (
                <li key={i.invitation_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate">{i.invited_email}</span>
                    <span className="block text-small text-hint">Invited</span>
                  </span>
                  {team.channel_status !== "draft" && (
                    <span className="flex flex-wrap items-center gap-1">
                      <CopyLink url={`${base}/invite/${i.invite_token}`} />
                      <ActionForm action={resendInviteAction.bind(null, i.invitation_id, team.project_id)} className="inline-flex items-center gap-2">
                        <SubmitButton variant="ghost" small pendingText="Sending…" className="!border-0 !px-2.5 !py-1 !text-primary hover:!bg-primary-tint">
                          Resend
                        </SubmitButton>
                      </ActionForm>
                      <ConfirmAction action={cancelInviteAction.bind(null, i.invitation_id, teamId)} label="Cancel" pendingText="Cancelling…" confirm={`Cancel the invite for ${i.invited_email}? The link will stop working.`} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <ActionForm action={addStudentAction.bind(null, teamId)} resetOnSuccess className="mt-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Field label="Add a student" htmlFor="add-email">
                    <input id="add-email" name="email" type="email" maxLength={100} placeholder="student@school.edu" className="field-input" />
                  </Field>
                </div>
                <SubmitButton pendingText="Adding…">
                  Add student
                </SubmitButton>
              </div>
            </ActionForm>
          </section>
        )}

        {tab === "ratings" && (
          <section className="max-w-3xl">
            <p className="text-small text-hint">Only you can see who gave which rating.</p>
            {results.matrix.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="No completed milestones yet">
                  Ratings open when you{" "}
                  <Link href={`/instructor/projects/${team.project_id}?tab=milestones`} className="link">
                    mark a milestone complete
                  </Link>
                  .
                </EmptyState>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {members.map((m) => {
                  const given = results.matrix.map(({ milestone, ratings }) => ({ milestone, ratings: ratings.filter((r) => r.fromId === m.user_id) }));
                  const done = given.filter((g) => g.ratings.length > 0).length;
                  return (
                    <li key={m.user_id}>
                      {/* One collapsible row per student: open it to see the ratings they gave. */}
                      <details className="group card overflow-hidden">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-wash [&::-webkit-details-marker]:hidden">
                          <span className="min-w-0 truncate font-semibold">
                            {m.first_name} {m.last_name}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Chip tone={done === given.length ? "confirmed" : "pending"}>
                              {done} of {given.length} submitted
                            </Chip>
                            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4 text-hint transition-transform duration-200 group-open:rotate-180">
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </span>
                        </summary>
                        <div className="space-y-4 border-t border-line px-4 py-3">
                          {given.map(({ milestone, ratings }) => (
                            <div key={milestone.milestone_id}>
                              <p className="section-label">{milestone.milestone_name}</p>
                              {ratings.length === 0 ? (
                                <p className="mt-1 text-small text-hint">Not submitted yet.</p>
                              ) : (
                                <ul className="mt-1 divide-y divide-line text-small">
                                  {ratings.map((r) => (
                                    <li key={r.toId} className="py-2">
                                      <div className="flex justify-between gap-2">
                                        <span>{r.to}</span>
                                        <span className="font-semibold">{r.score}/5</span>
                                      </div>
                                      {r.comment && <p className="text-hint">“{r.comment}”</p>}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {tab === "tasks" && (
          <div className="grid gap-8 lg:grid-cols-2">
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
                  <Field label="Reason" htmlFor="reason">
                    <input id="reason" name="reason" maxLength={255} placeholder="The team sees this, e.g. agreed in office hours" className="field-input" />
                  </Field>
                  <SubmitButton pendingText="Saving…">Record reassignment</SubmitButton>
                </ActionForm>
              )}
            </section>
            <section>
              <h2 className="text-heading">History</h2>
              {history.length === 0 ? (
                <p className="mt-1 text-small text-hint">No reassignments or deleted tasks yet.</p>
              ) : (
                <div className="mt-3">
                  <TaskHistoryList items={history} viewer="instructor" />
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "settings" && (
          <div className="max-w-2xl space-y-6">
            {team.channel_status === "published" && (
              <section className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Finish channel</p>
                    <p className="text-small text-hint">Students can still read it but can&apos;t log new work.</p>
                  </div>
                  <ActionForm action={finishTeamAction.bind(null, teamId)}>
                    <SubmitButton variant="secondary" small pendingText="Finishing…">
                      Finish channel
                    </SubmitButton>
                  </ActionForm>
                </div>
              </section>
            )}
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
        )}
      </Page>
    </>
  );
}
