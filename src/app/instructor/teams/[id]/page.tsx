import Link from "next/link";
import { addStudentAction, cancelInviteAction, deleteTeamAction, finishTeamAction, reassignAction, removeMemberAction, resendInviteAction } from "@/app/actions/instructor";
import { appUrl } from "@/app/actions/helpers";
import { ConfirmAction } from "@/components/confirm-action";
import { CopyLink } from "@/components/copy-link";
import { DangerZone } from "@/components/danger-zone";
import { handlePageError } from "@/components/access-denied";
import { ActivityRow } from "@/components/activity-row";
import { HoursPanel, type HoursRow } from "@/components/hours-panel";
import { MoreMenu } from "@/components/more-menu";
import { UrlSelect } from "@/components/url-select";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ArrowIcon, Chip, EmptyState, Field, HeaderBar, Page, PageTabs, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getTeamRoster } from "@/lib/services/class-setup";
import { getChannel } from "@/lib/services/contribution-service";
import { teamRatings } from "@/lib/services/peer-evaluation";
import { formatShare } from "@/lib/rules";
import { getTaskHistory, teamSignals } from "@/lib/services/team-health";
import { TaskHistoryList } from "@/components/task-history";

export const metadata = { title: "Team" };

const TABS = ["overview", "members", "ratings", "history", "settings"] as const;
const feedFilters = [
  { value: "all", label: "All entries" },
  { value: "pending", label: "Waiting" },
  { value: "confirmed", label: "Confirmed" },
  { value: "disputed", label: "Disputed" },
];
type Tab = (typeof TABS)[number];

export default async function InstructorTeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; show?: string }> }) {
  const user = await requireUser(["instructor"]);
  const teamId = Number((await params).id);
  const sp = await searchParams;
  const tabParam = sp.tab === "tasks" ? "history" : sp.tab; // Old links to the Tasks tab still work.
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

  const showRaw = sp.show ?? "all";
  const show = feedFilters.some((f) => f.value === showRaw) ? showRaw : "all";
  const shown = feed.filter((c) => (show === "all" ? true : c.verification_status === show));
  const hours: HoursRow[] = members
    .filter((m) => m.access_level === "write")
    .map((m) => {
      const mine = feed.filter((c) => c.user_id === m.user_id && c.verification_status === "confirmed");
      return { id: m.user_id, name: `${m.first_name} ${m.last_name}`, hours: mine.reduce((s, c) => s + (c.hours_spent ?? 0), 0), entries: mine.length };
    });
  const status = team.channel_status === "published" ? "Active" : team.channel_status === "finished" ? "Finished" : "Draft";

  return (
    <>
      <HeaderBar
        title={team.team_name}
        subtitle={`${team.course_code} Section ${team.section_number}`}
        crumbs={[
          { href: "/instructor", label: "Dashboard" },
          { href: `/instructor/projects/${team.project_id}`, label: team.project_name },
        ]}
        right={
          <Link
            href={`/teams/${teamId}`}
            className="flex shrink-0 flex-col items-end gap-1 rounded-2xl bg-white/15 px-3.5 py-2 text-right text-white ring-1 ring-white/30 transition-colors hover:bg-white/25 sm:px-4"
          >
            <span className="inline-flex items-center gap-1 text-small font-semibold">
              Student view <ArrowIcon />
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap opacity-90">
              <span aria-hidden className={`size-1.5 rounded-full ${status === "Active" ? "bg-emerald-400" : "bg-white/60"}`} />
              {status}
            </span>
          </Link>
        }
      />
      <Page>
        <PageTabs
          base={href}
          active={tab}
          items={[
            { key: "overview", label: "Overview" },
            { key: "members", label: "Members", count: roster.members.length + roster.pending.length },
            { key: "ratings", label: "Ratings" },
            { key: "history", label: "History", count: feed.length + history.length },
            { key: "settings", label: "Settings" },
          ]}
        />

        {tab === "overview" && (
          <div className="grid items-start gap-4 sm:gap-6 md:grid-cols-2">
            {signal?.needsAttention ? (
              <Panel title="Needs attention" tone="primary" count={signal.reasons.length}>
                {[
                  ...signal.reasons.map((r) => (
                    <li key={r} className="flex items-start gap-2.5 px-4 py-3 sm:px-5">
                      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                      {r}
                    </li>
                  )),
                  <li key="actions" className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
                    {(signal.openDisputes > 0 || signal.openFlags > 0) && (
                      <Link href="/instructor/reviews" className="link inline-flex items-center gap-1 text-small">
                        Review disputes and flags <ArrowIcon />
                      </Link>
                    )}
                    {signal.inactive.length > 0 && (
                      <Link href={`${href}?tab=history`} className="link inline-flex items-center gap-1 text-small">
                        Reassign a task <ArrowIcon />
                      </Link>
                    )}
                  </li>,
                ]}
              </Panel>
            ) : (
              <Panel title="On track" tone="confirmed">
                {[
                  <li key="ok" className="px-4 py-3 text-small text-hint sm:px-5">
                    No warnings: everyone is logging work and there are no open disputes or flags.
                  </li>,
                ]}
              </Panel>
            )}
            <HoursPanel rows={hours} />
          </div>
        )}

        {tab === "members" && (
          <div className="grid items-start gap-4 sm:gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Panel title="Members" tone="primary" menus count={roster.members.length + roster.pending.length} empty="No students yet.">
              {[
                ...roster.members.map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <span className="min-w-0">
                      <span className="block">
                        {m.first_name} {m.last_name}
                        {m.team_role && <span className="text-small text-hint"> · {m.team_role}</span>}
                      </span>
                      <span className="block truncate text-small text-hint">{m.email}</span>
                    </span>
                    <MoreMenu label={`Actions for ${m.first_name} ${m.last_name}`}>
                      <ConfirmAction
                        menu
                        action={removeMemberAction.bind(null, teamId, m.user_id)}
                        label="Remove from team"
                        confirm={`Remove ${m.first_name} ${m.last_name} from ${team.team_name}? Their logged work stays in the log.`}
                      />
                    </MoreMenu>
                  </li>
                )),
                ...roster.pending.map((i) => (
                  <li key={i.invitation_id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <span className="min-w-0">
                      <span className="block truncate">{i.invited_email}</span>
                      <span className="block text-small text-secondary-ink">Invited, hasn&apos;t joined</span>
                    </span>
                    {team.channel_status !== "draft" && (
                      <span className="flex shrink-0 items-center gap-1">
                        <CopyLink url={`${base}/invite/${i.invite_token}`} />
                        <MoreMenu label={`Invite actions for ${i.invited_email}`}>
                          <ActionForm action={resendInviteAction.bind(null, i.invitation_id, team.project_id)}>
                            <button className="menu-item">Resend email</button>
                          </ActionForm>
                          <ConfirmAction menu action={cancelInviteAction.bind(null, i.invitation_id, teamId)} label="Cancel invite" confirm={`Cancel the invite for ${i.invited_email}? The link will stop working.`} />
                        </MoreMenu>
                      </span>
                    )}
                  </li>
                )),
              ]}
            </Panel>
            <section className="card">
              <div className="card-head rounded-t-(--radius-card)">
                <h2>Add a student</h2>
              </div>
              <ActionForm action={addStudentAction.bind(null, teamId)} resetOnSuccess className="space-y-3 p-4 sm:p-5">
                <Field label="School email" htmlFor="add-email">
                  <input id="add-email" name="email" type="email" maxLength={100} placeholder="student@school.edu" className="field-input" />
                </Field>
                <SubmitButton full pendingText="Adding…">
                  Add student
                </SubmitButton>
              </ActionForm>
            </section>
          </div>
        )}

        {tab === "ratings" && (
          <>
            <p className="mb-3 text-small text-hint">Self is the share of the work students gave themselves. Peers is the average their teammates gave them. Gap is Self minus Peers.</p>
            {results.matrix.length === 0 ? (
              <EmptyState title="No completed milestones yet">
                Ratings open when you{" "}
                <Link href={`/instructor/projects/${team.project_id}?tab=milestones`} className="link">
                  mark a milestone complete
                </Link>
                .
              </EmptyState>
            ) : (
              <>
              {results.matrix.some((x) => x.comparison.length > 0) && (
                <div className="mb-4 grid items-start gap-3 md:grid-cols-2">
                  {results.matrix
                    .filter((x) => x.comparison.length > 0)
                    .map(({ milestone, comparison }) => (
                      <section key={milestone.milestone_id} className="card overflow-hidden">
                        <div className="card-head bg-secondary-tint">
                          <h3 className="font-semibold">{milestone.milestone_name}</h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-small">
                            <thead>
                              <tr className="text-left text-hint">
                                <th scope="col" className="px-4 py-2 font-medium">Student</th>
                                <th scope="col" className="px-2 py-2 text-right font-medium">Self</th>
                                <th scope="col" className="px-2 py-2 text-right font-medium">Peers</th>
                                <th scope="col" className="px-4 py-2 text-right font-medium">Gap</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                              {comparison.map((c) => (
                                <tr key={c.userId}>
                                  <th scope="row" className="px-4 py-2 text-left font-normal">{c.name}</th>
                                  <td className="px-2 py-2 text-right tabular-nums">{c.selfBp === null ? "None" : formatShare(c.selfBp)}</td>
                                  <td className="px-2 py-2 text-right tabular-nums">{c.peerAvgBp === null ? "None" : formatShare(c.peerAvgBp)}</td>
                                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{c.gapBp === null ? "None" : `${c.gapBp > 0 ? "+" : ""}${(c.gapBp / 100).toFixed(2)}`}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    ))}
                </div>
              )}
              <ul className="grid items-start gap-3 md:grid-cols-2">
                {members.map((m) => {
                  const given = results.matrix.map(({ milestone, ratings }) => ({ milestone, ratings: ratings.filter((r) => r.fromId === m.user_id) }));
                  const done = given.filter((g) => g.ratings.length > 0).length;
                  return (
                    <li key={m.user_id}>
                      {/* One collapsible row per student: open it to see the ratings they gave. */}
                      <details className="group card overflow-hidden">
                        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-wash sm:px-5 [&::-webkit-details-marker]:hidden">
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
                        <div className="space-y-4 border-t border-line px-4 py-3 sm:px-5">
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
                                        <span className="font-semibold tabular-nums">{r.shareBp !== null ? formatShare(r.shareBp) : `${r.score}/5`}</span>
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
              </>
            )}
          </>
        )}

        {tab === "history" && (
          <div className="grid items-start gap-4 sm:gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Panel
              title="Work log"
              count={feed.length}
              action={<UrlSelect name="show" value={show} options={feedFilters} label="Show" keep={{ tab: "history" }} />}
              empty={feed.length === 0 ? "Nothing logged yet." : "Nothing matches this filter."}
            >
              {shown.map((c) => (
                <ActivityRow key={c.contribution_id} c={{ ...c, canVerify: false }} />
              ))}
            </Panel>

            <div className="space-y-4 sm:space-y-6">
              <section className="card overflow-hidden">
                <div className="card-head">
                  <h2 className="flex items-center gap-2">
                    Task history
                    {history.length > 0 && <span className="rounded-full bg-wash px-2 py-0.5 text-small font-normal text-hint">{history.length}</span>}
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  {history.length === 0 ? <p className="text-center text-hint">No reassignments or deleted tasks yet.</p> : <TaskHistoryList items={history} viewer="instructor" />}
                </div>
              </section>
              <section className="card">
                <div className="card-head rounded-t-(--radius-card) bg-primary-tint">
                  <h2 className="flex items-center gap-2">
                    <span aria-hidden className="size-2 rounded-full bg-primary" />
                    Reassign a task
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  <p className="mb-4 text-small text-hint">After meeting the team, record who takes over. Future work on the task counts for the new owner.</p>
                  {assignedTasks.length === 0 ? (
                    <p className="text-hint">The team hasn&apos;t assigned any tasks yet.</p>
                  ) : (
                    <ActionForm action={reassignAction.bind(null, teamId)} resetOnSuccess className="space-y-3">
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
                      <SubmitButton full pendingText="Saving…">
                        Record reassignment
                      </SubmitButton>
                    </ActionForm>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="grid items-start gap-4 sm:gap-6 md:grid-cols-2">
            {team.channel_status === "published" && (
              <section className="card p-4 sm:p-5">
                <p className="font-semibold">Finish channel</p>
                <p className="mt-1 text-small text-hint">Students can still read it but can&apos;t log new work.</p>
                <ActionForm action={finishTeamAction.bind(null, teamId)} className="mt-4">
                  <SubmitButton variant="secondary" small pendingText="Finishing…">
                    Finish channel
                  </SubmitButton>
                </ActionForm>
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
