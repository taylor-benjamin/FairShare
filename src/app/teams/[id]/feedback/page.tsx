import { handlePageError } from "@/components/access-denied";
import { formatHours, Page, Panel, StatTile } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { myFeedback } from "@/lib/services/peer-evaluation";
import { average, formatShare } from "@/lib/rules";

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
  const { ratings, shareMilestones, myAverage, teamAverage, confirmedHours, confirmedCount, anonymous } = data;
  const compared = shareMilestones.filter((m) => m.selfBp !== null && m.peerAvgBp !== null);
  const avgSelf = average(compared.map((m) => m.selfBp!));
  const avgPeers = average(compared.map((m) => m.peerAvgBp!));
  const pct = (bp: number | null) => (bp === null ? "None" : formatShare(bp));
  const gap = (bp: number | null) => (bp === null ? "None" : `${bp > 0 ? "+" : ""}${formatShare(bp)}`);

  return (
    <Page>
      <h2 className="text-heading">My feedback</h2>
      <p className="mt-1 text-small text-hint">Only you can see this page.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="You said" value={pct(avgSelf)} caption="your share" tone="primary" />
        <StatTile label="Teammates said" value={pct(avgPeers)} caption="your share" tone="secondary" />
        <StatTile label="Hours" value={formatHours(confirmedHours) || "0 h"} caption="confirmed by teammates" tone="confirmed" />
        <StatTile label="Entries" value={confirmedCount} caption="confirmed by teammates" tone="confirmed" />
      </div>

      <div className="mt-6 space-y-4">
        <Panel title="You vs. teammates" tone="secondary" count={shareMilestones.length} empty="Ratings appear after your instructor completes a milestone and your teammates submit them.">
          {shareMilestones.map((m) => (
            <li key={m.milestoneId} className="px-4 py-3 sm:px-5">
              <p className="font-semibold">{m.milestone}</p>
              <dl className="mt-2 grid grid-cols-3 gap-3 text-small">
                <div>
                  <dt className="text-hint">You said</dt>
                  <dd className="font-semibold tabular-nums">{pct(m.selfBp)}</dd>
                </div>
                <div>
                  <dt className="text-hint">Teammates said ({m.peerCount})</dt>
                  <dd className="font-semibold tabular-nums">{pct(m.peerAvgBp)}</dd>
                </div>
                <div>
                  <dt className="text-hint">Gap</dt>
                  <dd className="font-semibold tabular-nums">{gap(m.gapBp)}</dd>
                </div>
              </dl>
              {!anonymous && m.from.length > 0 && (
                <ul className="mt-2 space-y-1 text-small text-hint">
                  {m.from.map((f) => (
                    <li key={f.id} className="flex justify-between gap-2">
                      <span>{f.name}</span>
                      <span className="tabular-nums">{formatShare(f.shareBp)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </Panel>
        {ratings.length > 0 && (
          <Panel title="Earlier ratings" tone="secondary" count={ratings.length} empty="">
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
        )}
        {ratings.length > 0 && myAverage !== null && (
          <p className="text-small text-hint">
            Earlier average {myAverage.toFixed(2)} out of 5{teamAverage !== null ? `, team ${teamAverage.toFixed(2)}` : ""}.
          </p>
        )}
        <p className="mt-2 text-small text-hint">{anonymous ? "Ratings are anonymous, so names are hidden." : "Your class shows who gave each rating."}</p>
      </div>
    </Page>
  );
}
