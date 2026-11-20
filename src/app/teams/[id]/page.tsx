import { handlePageError } from "@/components/access-denied";
import { ActivityRow } from "@/components/activity-row";
import { HoursPanel, type HoursRow } from "@/components/hours-panel";
import { Page, Panel } from "@/components/ui";
import { UrlSelect } from "@/components/url-select";
import { logTaskAction } from "@/app/actions/team";
import { requireUser } from "@/lib/auth/session";
import { getChannel } from "@/lib/services/contribution-service";
import { LogTaskForm } from "./log-task-form";

export const metadata = { title: "Log & Verify" };

const filters = [
  { value: "all", label: "All entries" },
  { value: "mine", label: "My entries" },
  { value: "pending", label: "Waiting" },
  { value: "confirmed", label: "Confirmed" },
  { value: "disputed", label: "Disputed" },
];

/**
 * Team channel: Log & Verify. Left: log work, and confirmed hours per teammate.
 * Right: entries waiting on you, then the team's activity with a filter.
 */
export default async function TeamChannelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser();
  const teamId = Number((await params).id);
  const showRaw = (await searchParams).show ?? "all";
  const show = filters.some((f) => f.value === showRaw) ? showRaw : "all";
  let channel;
  try {
    channel = await getChannel(user, teamId);
  } catch (e) {
    return handlePageError(e);
  }
  const { feed, canWrite, myTasks, members } = channel;

  const toReview = feed.filter((c) => c.canVerify);
  const activity = feed.filter((c) => {
    if (c.canVerify) return false; // shown above
    if (show === "mine") return c.isMine;
    if (show === "pending" || show === "confirmed" || show === "disputed") return c.verification_status === show;
    return true;
  });

  // Confirmed hours per teammate: who is actually carrying the work.
  const writers = members.filter((m) => m.access_level === "write");
  const hours: HoursRow[] = writers.map((m) => {
    const mine = feed.filter((c) => c.user_id === m.user_id && c.verification_status === "confirmed");
    return { id: m.user_id, name: `${m.first_name} ${m.last_name}`, hours: mine.reduce((s, c) => s + (c.hours_spent ?? 0), 0), entries: mine.length, me: m.user_id === user.userId };
  });

  return (
    <Page>
      <div className="grid items-start gap-4 sm:gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-4 sm:space-y-6 md:sticky md:top-20">
          {canWrite && (
            <section className="card">
              {/* No overflow-hidden on this card: the date picker's calendar must be able to open past its edge. */}
              <div className="card-head rounded-t-(--radius-card) bg-primary-tint">
                <h2 className="flex items-center gap-2">
                  <span aria-hidden className="size-2 rounded-full bg-primary" />
                  Log work
                </h2>
              </div>
              <div className="p-4 sm:p-5">
                <LogTaskForm action={logTaskAction.bind(null, teamId)} tasks={myTasks} />
              </div>
            </section>
          )}

          <HoursPanel rows={hours} />
        </div>

        <div className="space-y-4 sm:space-y-6">
          {toReview.length > 0 && (
            <Panel title="Needs your review" tone="primary" count={toReview.length}>
              {toReview.map((c) => (
                <ActivityRow key={c.contribution_id} c={c} />
              ))}
            </Panel>
          )}

          <Panel
            title="Team activity"
            action={<UrlSelect name="show" value={show} options={filters} label="Show" />}
            empty={feed.length === 0 ? (canWrite ? "No work logged yet. Log the first thing you finished." : "Nothing has been logged yet.") : "Nothing matches this filter."}
          >
            {activity.map((c) => (
              <ActivityRow key={c.contribution_id} c={c} />
            ))}
          </Panel>
        </div>
      </div>
    </Page>
  );
}
