import Link from "next/link";
import { Chip, EmptyState, HeaderBar, LinkButton, Notice, Page } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { listMyProjects } from "@/lib/services/class-setup";
import { disputeQueue } from "@/lib/services/contribution-service";
import { flagQueue } from "@/lib/services/peer-evaluation";
import { teamSignals } from "@/lib/services/team-health";

export const metadata = { title: "Dashboard" };

/** Epic 3 — one card per team with plain-language "Needs your review" signals. */
export default async function InstructorDashboard() {
  const user = await requireUser(["instructor"]);
  const [projects, disputes, flags] = await Promise.all([listMyProjects(user), disputeQueue(user), flagQueue(user)]);
  const withSignals = await Promise.all(projects.map(async (p) => ({ project: p, teams: await teamSignals(user, p.project_id) })));
  const attention = withSignals.flatMap((p) => p.teams.filter((t) => t.needsAttention));
  const reviewCount = disputes.open.length + flags.open.length;

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
            {reviewCount > 0 ? (
              <Link href="/instructor/reviews" className="mb-6 block rounded-xl border border-primary/30 bg-primary-soft p-4 hover:border-primary">
                <p className="font-semibold text-primary">Needs your review</p>
                <p className="text-small">
                  {disputes.open.length > 0 && `${disputes.open.length} disputed ${disputes.open.length === 1 ? "entry" : "entries"}`}
                  {disputes.open.length > 0 && flags.open.length > 0 && " · "}
                  {flags.open.length > 0 && `${flags.open.length} unusual rating ${flags.open.length === 1 ? "pattern" : "patterns"}`} → Review now
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
                  <Link href={`/instructor/projects/${project.project_id}`} className="link text-small">
                    Manage project →
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
                              ) : t.visibility === "public" ? (
                                <Chip tone="neutral">Public</Chip>
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
