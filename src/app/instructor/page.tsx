import Link from "next/link";
import { ArrowIcon, Chip, EmptyState, HeaderBar, LinkButton, Notice, Page, Progress, StatTile } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { listMyProjects } from "@/lib/services/class-setup";
import { disputeQueue } from "@/lib/services/contribution-service";
import { flagQueue } from "@/lib/services/peer-evaluation";
import { teamSignals } from "@/lib/services/team-health";

export const metadata = { title: "Dashboard" };

/** Epic 3 — one card per team with plain-language "Needs your review" signals. */
export default async function InstructorDashboard({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const user = await requireUser(["instructor"]);
  const [projects, disputes, flags] = await Promise.all([listMyProjects(user), disputeQueue(user), flagQueue(user)]);
  const withSignals = await Promise.all(projects.map(async (p) => ({ project: p, teams: await teamSignals(user, p.project_id) })));
  const attention = withSignals.flatMap((p) => p.teams.filter((t) => t.needsAttention));
  const reviewCount = disputes.open.length + flags.open.length;
  const allTeams = withSignals.flatMap((p) => p.teams);
  const liveTeams = allTeams.filter((t) => t.channelStatus !== "draft");
  const onTrackPct = liveTeams.length ? Math.round(((liveTeams.length - attention.length) / liveTeams.length) * 100) : 0;

  return (
    <>
      <HeaderBar
        title={`Good to see you, ${user.firstName}`}
        subtitle="Your class projects at a glance"
        right={
          <LinkButton href="/instructor/projects/new" variant="secondary" small className="shrink-0 border-white bg-white">
            + New project
          </LinkButton>
        }
      />
      <Page>
        {deleted === "project" && (
          <div className="mb-6">
            <Notice tone="success">The project and all of its teams were deleted.</Notice>
          </div>
        )}
        {projects.length === 0 ? (
          <div className="mx-auto max-w-lg text-center">
            <h2 className="text-heading">Set up your first class project</h2>
            <p className="mt-2 text-hint">Pick a template, upload the class list you exported from Moodle, and FairShare creates a private channel for every team. It takes about ten minutes.</p>
            <LinkButton href="/instructor/projects/new" className="mt-5">
              Set up a class project
            </LinkButton>
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Teams" value={allTeams.length} caption={`across ${projects.length} ${projects.length === 1 ? "project" : "projects"}`} tone="primary" icon={<UsersIcon />} />
              <StatTile label="On track" value={`${onTrackPct}%`} caption={`${liveTeams.length - attention.length} of ${liveTeams.length} live teams`} tone="confirmed" icon={<CheckIcon />} />
              <StatTile label="Need attention" value={attention.length} caption="quiet teams or open issues" tone="secondary" icon={<AlertIcon />} />
              <StatTile label="To review" value={reviewCount} caption={`${disputes.open.length} ${disputes.open.length === 1 ? "dispute" : "disputes"} · ${flags.open.length} ${flags.open.length === 1 ? "flag" : "flags"}`} tone="disputed" icon={<FlagIcon />} href="/instructor/reviews" />
            </div>
            {liveTeams.length > 0 && (
              <div className="card mb-6 p-4 sm:p-5">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="font-semibold">Class health</p>
                  <p className="text-small text-hint">{onTrackPct}% of teams on track</p>
                </div>
                <Progress value={onTrackPct} tone="secondary" label="Share of teams on track" />
              </div>
            )}
            {reviewCount > 0 ? (
              <Link href="/instructor/reviews" className="mb-6 block rounded-(--radius-card) border border-primary/20 bg-primary-tint p-4 sm:p-5 hover:border-primary">
                <p className="font-semibold text-primary">Needs your review</p>
                <p className="text-small">
                  {disputes.open.length > 0 && `${disputes.open.length} disputed ${disputes.open.length === 1 ? "entry" : "entries"}`}
                  {disputes.open.length > 0 && flags.open.length > 0 && " · "}
                  {flags.open.length > 0 && `${flags.open.length} unusual rating ${flags.open.length === 1 ? "pattern" : "patterns"}`}{" "}
                  <span className="inline-flex items-center gap-1 font-semibold text-primary">
                    Review now <ArrowIcon />
                  </span>
                </p>
              </Link>
            ) : (
              <div className="mb-6">
                <Notice tone="success">Nothing needs your review right now.</Notice>
              </div>
            )}
            {attention.length > 0 && (
              <p className="mb-4 text-small text-hint">
                {attention.length} {attention.length === 1 ? "team needs" : "teams need"} attention. Teams on track are listed too, so you can check in any time.
              </p>
            )}

            {withSignals.map(({ project, teams }) => (
              <section key={project.project_id} className="mb-10">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-heading">{project.project_name}</h2>
                    <p className="text-small text-hint">
                      {project.course_code} {project.course_name} · Section {project.section_number}
                    </p>
                  </div>
                  <Link href={`/instructor/projects/${project.project_id}`} className="link inline-flex items-center gap-1 text-small">
                    Manage project <ArrowIcon />
                  </Link>
                </div>
                {teams.length === 0 ? (
                  <EmptyState title="No teams yet">
                    <Link href={`/instructor/projects/${project.project_id}/roster`} className="link">
                      Upload your class list
                    </Link>{" "}
                    to create team channels.
                  </EmptyState>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[...teams]
                      .sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention))
                      .map((t) => (
                        <li key={t.teamId}>
                          <Link
                            href={`/instructor/teams/${t.teamId}`}
                            className={`card block h-full border-l-4 p-4 hover:border-primary ${t.needsAttention ? "border-l-primary" : "border-l-confirmed"}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold">{t.teamName}</p>
                              {t.channelStatus === "draft" ? (
                                <Chip tone="pending">Draft</Chip>
                              ) : t.needsAttention ? (
                                <Chip tone="review">Needs your review</Chip>
                              ) : t.channelStatus === "finished" ? (
                                <Chip tone="pending">Finished</Chip>
                              ) : (
                                <Chip tone="confirmed">On track</Chip>
                              )}
                            </div>
                            <p className={`mt-1 text-small ${t.needsAttention ? "text-primary" : "text-hint"}`}>
                              {t.channelStatus === "draft" ? "Not published yet" : t.headline}
                            </p>
                            {t.reasons.length > 0 && (
                              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-small">
                                {t.reasons.map((r) => (
                                  <li key={r}>{r}</li>
                                ))}
                              </ul>
                            )}
                            <p className="mt-2 text-small text-hint">{t.memberCount} members</p>
                          </Link>
                        </li>
                      ))}
                  </ul>
                )}
              </section>
            ))}
          </>
        )}
      </Page>
    </>
  );
}

const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className: "size-5", "aria-hidden": true } as const;
function UsersIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.4c1.9.8 3 2.9 3 5.6" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5M12 16.2v.1" />
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
