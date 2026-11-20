import { handlePageError } from "@/components/access-denied";
import { formatHours, Page, Panel, StatTile } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { myFeedback } from "@/lib/services/peer-evaluation";

export const metadata = { title: "My feedback" };

/** A student's private dashboard: ratings they received and their confirmed work. */
export default async function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const teamId = Number((await params).id);
  let data;
  try {
    data = await myFeedback(user, teamId);
  } catch (e) {
    return handlePageError(e);
  }
  const { ratings, myAverage, teamAverage, confirmedHours, confirmedCount, anonymous } = data;

  return (
    <Page>
      <h2 className="text-heading">My feedback</h2>
      <p className="mt-1 text-small text-hint">Only you can see this page.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Your rating" value={myAverage !== null ? myAverage.toFixed(2) : "None"} caption="average, out of 5" tone="primary" />
        <StatTile label="Team rating" value={teamAverage !== null ? teamAverage.toFixed(2) : "None"} caption="team average" tone="secondary" />
        <StatTile label="Hours" value={formatHours(confirmedHours) || "0 h"} caption="confirmed by teammates" tone="confirmed" />
        <StatTile label="Entries" value={confirmedCount} caption="confirmed by teammates" tone="confirmed" />
      </div>

      <div className="mt-6">
        <Panel title="Ratings you received" tone="secondary" count={ratings.length} empty="Ratings appear after your instructor completes a milestone and your teammates submit them.">
          {ratings.map((r) => (
            <li key={r.evaluationId} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <span className="min-w-0">
                {r.milestone}
                <span className="text-hint">{r.from ? ` · from ${r.from}` : " · from a teammate"}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{r.score}/5</span>
            </li>
          ))}
        </Panel>
        <p className="mt-2 text-small text-hint">{anonymous ? "Ratings are anonymous, so names are hidden." : "Your class shows who gave each rating."}</p>
      </div>
    </Page>
  );
}
