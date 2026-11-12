import { handlePageError } from "@/components/access-denied";
import { EmptyState, formatHours, Page } from "@/components/ui";
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
    <Page narrow>
      <h2 className="text-heading">My feedback</h2>
      <p className="mt-1 text-small text-hint">Only you can see this page.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Your average rating", myAverage !== null ? myAverage.toFixed(2) : "—"],
          ["Team average", teamAverage !== null ? teamAverage.toFixed(2) : "—"],
          ["Confirmed hours", formatHours(confirmedHours) || "0 h"],
          ["Confirmed entries", String(confirmedCount)],
        ].map(([label, value]) => (
          <div key={label} className="card p-3">
            <p className="text-small text-hint">{label}</p>
            <p className="mt-1 text-heading">{value}</p>
          </div>
        ))}
      </div>


      <h3 className="mt-8 font-semibold">Ratings you received</h3>
      <p className="text-small text-hint">{anonymous ? "Ratings are anonymous, so names are hidden." : "Your class shows who gave each rating."}</p>
      <div className="mt-3 space-y-2">
        {ratings.length === 0 ? (
          <EmptyState title="No ratings yet">Ratings appear after your instructor completes a milestone and your teammates submit them.</EmptyState>
        ) : (
          ratings.map((r) => (
            <div key={r.evaluationId} className="card p-3">
              <div className="flex justify-between text-small">
                <span className="text-hint">
                  {r.milestone}
                  {r.from ? ` · from ${r.from}` : " · from a teammate"}
                </span>
                <span className="font-semibold">{r.score}/5</span>
              </div>
            </div>
          ))
        )}
      </div>
    </Page>
  );
}
