import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { ArrowIcon, Chip, EmptyState, formatDate, formatHours, HeaderBar, Page, StatTile } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getStudentDashboard } from "@/lib/services/student-dashboard";

export const metadata = { title: "Dashboard" };

const statusChip = {
  confirmed: <Chip tone="confirmed">Confirmed</Chip>,
  pending: <Chip tone="pending">Waiting</Chip>,
  disputed: <Chip tone="disputed">Disputed</Chip>,
} as const;

/** The student's home after logging in: what needs them, their teams, and their recent work. */
export default async function StudentDashboard() {
  const user = await requireUser(["student"]);
  const data = await getStudentDashboard(user);

  return (
    <>
      <AppNav user={user} />
      <HeaderBar title={`Hi, ${user.firstName}`} subtitle="Your dashboard" />
      <Page>
        {!data || data.teams.length === 0 ? (
          <div className="mx-auto max-w-2xl">
            <EmptyState title="You're not on a team yet">When your instructor publishes your team, open the invite link from your email.</EmptyState>
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="To confirm" value={data.stats.toConfirm} caption="teammates' entries" tone="primary" icon={<CheckIcon />} />
              <StatTile label="Ratings due" value={data.stats.ratingsDue} caption="completed milestones" tone="secondary" icon={<StarIcon />} />
              <StatTile label="Confirmed hours" value={formatHours(data.stats.confirmedHours) || "0 h"} caption="your verified work" tone="confirmed" icon={<ClockIcon />} />
              <StatTile label="Disputed" value={data.stats.disputed} caption="of your entries" tone="disputed" icon={<FlagIcon />} />
            </div>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <div className="space-y-8">
                <section aria-labelledby="todo-heading">
                  <h2 id="todo-heading" className="section-label mb-3">
                    To do
                  </h2>
                  {data.todos.length === 0 ? (
                    <div className="card p-4 text-hint">You&apos;re all caught up.</div>
                  ) : (
                    <ul className="card divide-y divide-line overflow-hidden">
                      {data.todos.map((t) => (
                        <li key={t.key}>
                          <Link href={t.href} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-primary-tint/60">
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span aria-hidden className={`size-2 shrink-0 rounded-full ${t.tone === "warning" ? "bg-secondary" : "bg-primary"}`} />
                              <span className="truncate">{t.label}</span>
                            </span>
                            <ArrowIcon className="text-hint" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section aria-labelledby="teams-heading">
                  <h2 id="teams-heading" className="section-label mb-3">
                    My teams
                  </h2>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {data.teams.map((t) => (
                      <li key={t.teamId}>
                        <Link href={`/teams/${t.teamId}`} className="card block h-full p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold">{t.teamName}</p>
                            {t.status === "finished" ? <Chip tone="pending">Finished</Chip> : <Chip tone="confirmed">Active</Chip>}
                          </div>
                          <p className="mt-0.5 truncate text-small text-hint">{t.context}</p>
                          <p className="mt-2 text-small">{t.role ? `Your role: ${t.role}` : "No role set yet"}</p>
                          <p className="mt-1 text-small text-hint">
                            {[
                              t.toConfirm > 0 && `${t.toConfirm} to confirm`,
                              t.ratingsDue > 0 && `${t.ratingsDue} ${t.ratingsDue === 1 ? "rating" : "ratings"} due`,
                              `${formatHours(t.confirmedHours) || "0 h"} confirmed`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <section aria-labelledby="recent-heading">
                <h2 id="recent-heading" className="section-label mb-3">
                  Your recent work
                </h2>
                {data.recent.length === 0 ? (
                  <EmptyState title="Nothing logged yet">Open your team and log the first thing you finished.</EmptyState>
                ) : (
                  <ul className="card divide-y divide-line overflow-hidden">
                    {data.recent.map((c) => (
                      <li key={c.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0">{c.description}</p>
                          {statusChip[c.status]}
                        </div>
                        <p className="mt-0.5 text-small text-hint">
                          {data.multiTeam && `${c.teamName} · `}
                          {formatDate(c.completionDate)}
                          {c.hours !== null && ` · ${formatHours(c.hours)}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </Page>
    </>
  );
}

const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className: "size-5", "aria-hidden": true } as const;
function CheckIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg {...iconProps}>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
function FlagIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}
