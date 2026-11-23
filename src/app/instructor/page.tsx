import Link from "next/link";
import { ShareBar } from "@/components/hours-panel";
import { ArrowIcon, Chip, HeaderBar, LinkButton, Notice, Page, StatTile } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { listMyProjects } from "@/lib/services/class-setup";
import { disputeQueue } from "@/lib/services/contribution-service";
import { flagQueue } from "@/lib/services/peer-evaluation";
import { teamSignals, type TeamSignal } from "@/lib/services/team-health";

export const metadata = { title: "Dashboard" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Instructor home: each project's teams as rows with their warnings and every member's share of the
 * confirmed hours. Reviews and next steps live in the bell.
 */
export default async function InstructorDashboard({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const user = await requireUser(["instructor"]);
  const [projects, disputes, flags] = await Promise.all([listMyProjects(user), disputeQueue(user), flagQueue(user)]);
  const withSignals = await Promise.all(
    projects.map(async (p) => ({ project: p, teams: await teamSignals(user, p.project_id) })),
  );
  const attention = withSignals.flatMap((p) => p.teams.filter((t) => t.needsAttention));
  const reviewCount = disputes.open.length + flags.open.length;
  const allTeams = withSignals.flatMap((p) => p.teams);
  const liveTeams = allTeams.filter((t) => t.channelStatus !== "draft");
  const onTrackPct = liveTeams.length ? Math.round(((liveTeams.length - attention.length) / liveTeams.length) * 100) : 0;

  return (
    <>
      <HeaderBar title={`Good to see you, ${user.firstName}`} subtitle="Your class projects at a glance" />
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
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <StatTile label="Teams" value={allTeams.length} caption={`across ${plural(projects.length, "project", "projects")}`} tone="primary" />
              <StatTile label="On track" value={`${onTrackPct}%`} caption={`${liveTeams.length - attention.length} of ${liveTeams.length} live teams`} tone="confirmed" />
              <StatTile label="Need attention" value={attention.length} caption="teams with warnings" tone="secondary" />
              <StatTile label="To review" value={reviewCount} caption={`${plural(disputes.open.length, "dispute", "disputes")} · ${plural(flags.open.length, "flag", "flags")}`} tone="disputed" href="/instructor/reviews" />
            </div>

            {withSignals.map(({ project, teams }) => (
              <section key={project.project_id} className="card overflow-hidden">
                <div className="card-head">
                  <div className="min-w-0">
                    <h2 className="font-semibold">{project.project_name}</h2>
                    <p className="text-small text-hint">
                      {project.course_code} {project.course_name} · Section {project.section_number}
                    </p>
                  </div>
                  <Link href={`/instructor/projects/${project.project_id}`} className="link inline-flex shrink-0 items-center gap-1 text-small">
                    Open project <ArrowIcon />
                  </Link>
                </div>
                {teams.length === 0 ? (
                  <p className="px-4 py-6 text-center text-hint sm:px-5">No teams yet. Upload the class list from the New menu.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {[...teams]
                      .sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention))
                      .map((t) => (
                        <TeamRow key={t.teamId} t={t} />
                      ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </Page>
    </>
  );
}

/** One team: name, status, how many warnings, and each member's share of the confirmed hours. */
function TeamRow({ t }: { t: TeamSignal }) {
  const chip =
    t.channelStatus === "draft" ? (
      <Chip tone="pending">Draft</Chip>
    ) : t.needsAttention ? (
      <Chip tone="review">Needs your review</Chip>
    ) : t.channelStatus === "finished" ? (
      <Chip tone="pending">Finished</Chip>
    ) : (
      <Chip tone="confirmed">On track</Chip>
    );
  return (
    <li>
      <Link
        href={`/instructor/teams/${t.teamId}`}
        className={`grid gap-3 px-4 py-4 transition-colors hover:bg-primary-tint/60 sm:px-5 ${t.needsAttention ? "bg-primary-tint/40" : ""}`}
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{t.teamName}</span>
            {chip}
          </span>
          {/* Just a count here; the team page spells out each warning. */}
          <span className="mt-1 block text-small text-hint">
            {t.channelStatus === "draft" ? "Not published yet" : plural(t.memberCount, "member", "members")}
            {t.reasons.length > 0 && <span className="font-semibold text-primary-dark"> · {plural(t.reasons.length, "warning", "warnings")}</span>}
          </span>
        </span>
        {t.channelStatus !== "draft" && <ShareBar members={t.memberHours} />}
      </Link>
    </li>
  );
}
