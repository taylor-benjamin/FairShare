import { handlePageError } from "@/components/access-denied";
import { ContributionCard } from "@/components/contribution-card";
import { EmptyState, Page } from "@/components/ui";
import { logTaskAction } from "@/app/actions/team";
import { requireUser } from "@/lib/auth/session";
import { getChannel } from "@/lib/services/contribution-service";
import { LogTaskForm } from "./log-task-form";

export const metadata = { title: "Log & Verify" };

/** Key screen — Team Channel: Log & Verify (Milestone 2 §4.4). Phone first; two columns from md up. */
export default async function TeamChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const teamId = Number((await params).id);
  let channel;
  try {
    channel = await getChannel(user, teamId);
  } catch (e) {
    return handlePageError(e);
  }
  const { feed, canWrite, myTasks } = channel;
  const needsReview = feed.filter((c) => c.canVerify).length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Page>
      <div className={canWrite ? "grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" : ""}>
        {canWrite && (
          <section aria-label="Log a completed task" className="md:sticky md:top-16 md:self-start">
            <LogTaskForm action={logTaskAction.bind(null, teamId)} tasks={myTasks} today={today} />
          </section>
        )}

        <section aria-label="Team activity" className={canWrite ? "" : "mx-auto max-w-2xl"}>
          <div className="mb-3 flex items-center justify-between">
            <p className="section-label">Team activity</p>
            {needsReview > 0 && <p className="text-small text-primary">{needsReview} waiting for you</p>}
          </div>
          {feed.length === 0 ? (
            <EmptyState title="No work logged yet">{canWrite ? "Log the first thing you finished." : "Nothing has been logged in this channel."}</EmptyState>
          ) : (
            <div className="space-y-3">
              {feed.map((c) => (
                <ContributionCard key={c.contribution_id} c={c} />
              ))}
            </div>
          )}

        </section>
      </div>
    </Page>
  );
}
