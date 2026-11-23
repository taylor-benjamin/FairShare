import { AppNav } from "@/components/app-nav";
import { Chip, EmptyState, formatDate, formatHours, HeaderBar, Page, Panel, RowLink, StatTile } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getStudentDashboard } from "@/lib/services/student-dashboard";

export const metadata = { title: "Dashboard" };

const statusChip = {
  confirmed: <Chip tone="confirmed">Confirmed</Chip>,
  pending: <Chip tone="pending">Waiting</Chip>,
  disputed: <Chip tone="disputed">Disputed</Chip>,
} as const;

/** The student's home after logging in: their teams, what's due, and their recent work. To-dos live in the bell. */
export default async function StudentDashboard() {
  const user = await requireUser(["student"]);
  const data = await getStudentDashboard(user);

  return (
    <>
      <AppNav user={user} />
      <HeaderBar title={`Hi, ${user.firstName}`} subtitle="Your teams at a glance" />
      <Page>
        {!data || data.teams.length === 0 ? (
          <div className="mx-auto max-w-2xl">
            <EmptyState title="You're not on a team yet">When your instructor publishes your team, open the invite link from your email.</EmptyState>
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <StatTile label="To confirm" value={data.stats.toConfirm} caption="teammates' entries" tone="primary" />
              <StatTile label="Ratings due" value={data.stats.ratingsDue} caption="completed milestones" tone="secondary" />
              <StatTile label="Confirmed hours" value={formatHours(data.stats.confirmedHours) || "0 h"} caption="your verified work" tone="confirmed" />
              <StatTile label="Disputed" value={data.stats.disputed} caption="of your entries" tone="disputed" />
            </div>

            {/* One grid, so the boxes in each row start at the same line; each is only as tall as its content. */}
            <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
                <Panel title="My teams" tone="confirmed">
                  {data.teams.map((t) => (
                    <RowLink key={t.teamId} href={`/teams/${t.teamId}`}>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-semibold">{t.teamName}</span>
                          {t.status === "finished" ? <Chip tone="pending">Finished</Chip> : <Chip tone="confirmed">Active</Chip>}
                        </span>
                        <span className="block truncate text-small text-hint">
                          {[t.role ?? "No role yet", `${formatHours(t.confirmedHours) || "0 h"} confirmed`, t.toConfirm > 0 && `${t.toConfirm} to confirm`].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </RowLink>
                  ))}
                </Panel>

                <Panel title="Coming up" tone="secondary" count={data.deadlines.length} empty="Nothing due in the next two weeks.">
                  {data.deadlines.map((d) => (
                    <RowLink key={d.key} href={d.href}>
                      <span className="min-w-0">
                        <span className="block truncate">{d.title}</span>
                        <span className="block truncate text-small text-hint">
                          {d.kind}
                          {data.multiTeam && ` · ${d.teamName}`} · {formatDate(d.due)}
                        </span>
                      </span>
                      <Chip tone={d.overdue ? "disputed" : "warning"}>{d.when}</Chip>
                    </RowLink>
                  ))}
                </Panel>

                <div className="lg:col-span-2">
                  <Panel title="Your recent work" empty="Nothing logged yet. Open your team and log the first thing you finished.">
                    {data.recent.map((c) => (
                      <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
                        <span className="min-w-0">
                          <span className="block">{c.description}</span>
                          <span className="block text-small text-hint">
                            {data.multiTeam && `${c.teamName} · `}
                            {formatDate(c.completionDate)}
                            {c.hours !== null && ` · ${formatHours(c.hours)}`}
                          </span>
                        </span>
                        {statusChip[c.status]}
                      </li>
                    ))}
                  </Panel>
                </div>
            </div>
          </>
        )}
      </Page>
    </>
  );
}
