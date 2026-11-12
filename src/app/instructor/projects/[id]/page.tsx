import Link from "next/link";
import { addMilestoneAction, completeMilestoneAction, deleteProjectAction, publishAction } from "@/app/actions/instructor";
import { DangerZone } from "@/components/danger-zone";
import { handlePageError } from "@/components/access-denied";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Stepper } from "@/components/stepper";
import { Chip, EmptyState, Field, formatDate, HeaderBar, LinkButton, Notice, Page } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getSetupOverview } from "@/lib/services/class-setup";

export const metadata = { title: "Project" };

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const user = await requireUser(["instructor"]);
  const projectId = Number((await params).id);
  let data;
  try {
    data = await getSetupOverview(user, projectId);
  } catch (e) {
    return handlePageError(e);
  }
  const { project, teams, milestones, settings } = data;
  const drafts = teams.filter((t) => t.channel_status === "draft");
  const live = teams.filter((t) => t.channel_status !== "draft");
  const step = teams.length === 0 ? 2 : drafts.length > 0 ? 4 : 5;

  return (
    <>
      <HeaderBar title={project.project_name} subtitle={`${project.course_code} ${project.course_name} · Section ${project.section_number}`} back={{ href: "/instructor", label: "Dashboard" }} />
      <Page>
        {deleted === "team" && (
          <div className="mb-6">
            <Notice tone="success">The team was deleted.</Notice>
          </div>
        )}
        {step <= 4 && (
          <div className="mx-auto max-w-2xl">
            <Stepper current={step} />
          </div>
        )}

        {teams.length === 0 && (
          <div className="mx-auto max-w-2xl">
            <EmptyState title="Next: upload your class list">
              <LinkButton href={`/instructor/projects/${projectId}/roster`} className="mt-3">
                Upload class list
              </LinkButton>
            </EmptyState>
          </div>
        )}

        {drafts.length > 0 && (
          <section className="card mx-auto mb-8 max-w-2xl border-primary p-5">
            <h2 className="text-heading">Ready to publish {drafts.length} team channel{drafts.length === 1 ? "" : "s"}</h2>
            <p className="mt-1 text-hint">
              Each student gets an email with a one-time sign-up link that puts them straight into their team. Settings: students{" "}
              {settings.access === "write" ? "can log and confirm work" : "have read-only access"}; ratings are {settings.anonymous ? "anonymous" : "named"}.{" "}
              <Link href={`/instructor/projects/${projectId}/settings`} className="link">
                Change
              </Link>
            </p>
            <ActionForm action={publishAction.bind(null, projectId)} className="mt-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <SubmitButton full pendingText="Publishing and sending invites…">
                  Publish team channels
                </SubmitButton>
                <LinkButton href={`/instructor/projects/${projectId}/roster`} variant="secondary" full>
                  Replace list
                </LinkButton>
              </div>
            </ActionForm>
          </section>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section>
            <p className="section-label mb-3">Teams</p>
            {teams.length > 0 && (
              <ul className="grid gap-3 sm:grid-cols-2">
                {teams.map((t) => {
                  const accepted = t.invitations.filter((i) => i.invite_status === "accepted").length;
                  return (
                    <li key={t.team_id} className="card p-4">
                      <div className="flex items-start justify-between gap-2">
                        {t.channel_status === "draft" ? (
                          <p className="font-semibold">{t.team_name}</p>
                        ) : (
                          <Link href={`/instructor/teams/${t.team_id}`} className="font-semibold text-primary hover:underline">
                            {t.team_name}
                          </Link>
                        )}
                        <Chip tone={t.channel_status === "draft" ? "pending" : t.visibility === "public" ? "neutral" : t.channel_status === "finished" ? "pending" : "confirmed"}>
                          {t.channel_status === "draft" ? "Draft" : t.visibility === "public" ? "Public" : t.channel_status === "finished" ? "Finished" : "Published"}
                        </Chip>
                      </div>
                      <p className="mt-1 text-small text-hint">
                        {t.channel_status === "draft" ? `${t.invitations.length} students to invite` : `${accepted} of ${t.invitations.length} students joined`}
                      </p>
                      <ul className="mt-2 space-y-0.5 text-small">
                        {t.invitations.map((i) => (
                          <li key={i.invitation_id} className="flex justify-between gap-2">
                            <span className="truncate">{i.invited_email}</span>
                            <span className={i.invite_status === "accepted" ? "text-confirmed" : "text-hint"}>{i.invite_status === "accepted" ? "joined" : t.channel_status === "draft" ? "" : "invited"}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
            {live.length > 0 && <p className="mt-3 text-small text-hint">Open a team to see its work log, ratings, contribution scores, and to record task reassignments.</p>}
          </section>

          <section>
            <p className="section-label mb-3">Milestones</p>
            <p className="mb-3 text-small text-hint">Completing a milestone opens peer ratings.</p>
            <ul className="space-y-2">
              {milestones.map((m) => (
                <li key={m.milestone_id} className="card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{m.milestone_name}</p>
                      <p className="text-small text-hint">Due {formatDate(m.due_date, true)}</p>
                    </div>
                    {m.milestone_status === "completed" ? <Chip tone="confirmed">Complete</Chip> : <Chip tone="pending">Open</Chip>}
                  </div>
                  {m.milestone_status === "open" && (
                    <ActionForm action={completeMilestoneAction.bind(null, m.milestone_id, projectId)} className="mt-2">
                      <SubmitButton variant="secondary" small pendingText="Saving…">
                        Mark complete
                      </SubmitButton>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
            <ActionForm action={addMilestoneAction.bind(null, projectId)} resetOnSuccess className="card mt-4 space-y-3 p-3">
              <p className="text-small font-semibold">Add a milestone</p>
              <Field label="Name" htmlFor="ms-name">
                <input id="ms-name" name="name" maxLength={100} placeholder="Milestone 3: Final report" className="field-input" />
              </Field>
              <Field label="Due date" htmlFor="ms-due">
                <input id="ms-due" name="dueDate" type="date" className="field-input" />
              </Field>
              <SubmitButton variant="secondary" small pendingText="Adding…">
                Add milestone
              </SubmitButton>
            </ActionForm>
          </section>
        </div>
        <section className="mt-12 border-t border-line pt-6">
          <DangerZone
            action={deleteProjectAction.bind(null, projectId)}
            thing="project"
            name={project.project_name}
            consequences={[
              `All ${teams.length} team ${teams.length === 1 ? "channel" : "channels"} in this project, including any public ones`,
              "Every work log entry, confirmation, dispute, rating, comment and flag in those teams",
              `The project's ${milestones.length} ${milestones.length === 1 ? "milestone" : "milestones"}, charters, tasks and invite links`,
            ]}
          />
          <p className="mt-2 text-small text-hint">The course ({project.course_code} Section {project.section_number}) is kept so you can start a new project in it.</p>
        </section>
      </Page>
    </>
  );
}
