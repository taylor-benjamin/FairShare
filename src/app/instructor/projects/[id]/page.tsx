import Link from "next/link";
import { addMilestoneAction, completeMilestoneAction, deleteProjectAction, publishAction, resendInviteAction } from "@/app/actions/instructor";
import { appUrl } from "@/app/actions/helpers";
import { CopyLink } from "@/components/copy-link";
import { DangerZone } from "@/components/danger-zone";
import { handlePageError } from "@/components/access-denied";
import { ActionForm, SubmitButton } from "@/components/forms";
import { NextStepCard } from "@/components/next-step";
import { Stepper } from "@/components/stepper";
import { ArrowIcon, Chip, EmptyState, Field, formatDate, HeaderBar, LinkButton, Notice, Page, PageTabs } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getSetupOverview, projectNextStep } from "@/lib/services/class-setup";

export const metadata = { title: "Project" };

const TABS = ["teams", "milestones", "settings"] as const;
type Tab = (typeof TABS)[number];

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ deleted?: string; tab?: string }> }) {
  const { deleted, tab: tabParam } = await searchParams;
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "teams";
  const user = await requireUser(["instructor"]);
  const projectId = Number((await params).id);
  let data, next;
  try {
    [data, next] = await Promise.all([getSetupOverview(user, projectId), projectNextStep(user, projectId)]);
  } catch (e) {
    return handlePageError(e);
  }
  const { project, teams, milestones, settings } = data;
  const base = await appUrl();
  const href = `/instructor/projects/${projectId}`;
  const drafts = teams.filter((t) => t.channel_status === "draft");
  const step = teams.length === 0 ? 2 : drafts.length > 0 ? 4 : 5;
  const inSetup = step <= 4;

  return (
    <>
      <HeaderBar
        title={project.project_name}
        subtitle={`${project.course_code} ${project.course_name} · Section ${project.section_number}`}
        crumbs={[{ href: "/instructor", label: "Dashboard" }]}
      />
      <Page>
        {deleted === "team" && (
          <div className="mb-6">
            <Notice tone="success">The team was deleted.</Notice>
          </div>
        )}

        {/* Setup: the stepper and the one action that finishes it */}
        {inSetup && (
          <div className="mx-auto mb-8 max-w-2xl">
            <Stepper current={step} />
            {teams.length === 0 ? (
              <EmptyState title="Upload your class list">
                <LinkButton href={`${href}/roster`} className="mt-3">
                  Upload class list
                </LinkButton>
              </EmptyState>
            ) : (
              <section className="card border-primary p-5">
                <h2 className="text-heading">
                  Publish {drafts.length} team {drafts.length === 1 ? "channel" : "channels"}
                </h2>
                <p className="mt-1 text-hint">
                  Each student gets a one-time sign-up link that puts them straight into their team. Ratings are {settings.anonymous ? "anonymous" : "named"}.{" "}
                  <Link href={`${href}/settings`} className="link">
                    Change
                  </Link>
                </p>
                <ActionForm action={publishAction.bind(null, projectId)} className="mt-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <SubmitButton full pendingText="Publishing and sending invites…">
                      Publish team channels
                    </SubmitButton>
                    <LinkButton href={`${href}/roster`} variant="secondary" full>
                      Replace list
                    </LinkButton>
                  </div>
                </ActionForm>
              </section>
            )}
          </div>
        )}

        {!inSetup && next && (
          <div className="mb-6">
            <NextStepCard step={next} projectId={projectId} />
          </div>
        )}

        <PageTabs
          base={href}
          active={tab}
          items={[
            { key: "teams", label: "Teams", count: teams.length },
            { key: "milestones", label: "Milestones", count: milestones.length },
            { key: "settings", label: "Settings" },
          ]}
        />

        {tab === "teams" &&
          (teams.length === 0 ? (
            <EmptyState title="No teams yet">Upload your class list to create them.</EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((t) => {
                const joined = t.invitations.filter((i) => i.invite_status === "accepted").length;
                const pending = t.invitations.filter((i) => i.invite_status === "pending");
                const isDraft = t.channel_status === "draft";
                return (
                  <li key={t.team_id} className="card flex flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{t.team_name}</p>
                      <Chip tone={isDraft || t.channel_status === "finished" ? "pending" : "confirmed"}>
                        {isDraft ? "Draft" : t.channel_status === "finished" ? "Finished" : "Active"}
                      </Chip>
                    </div>
                    <p className="mt-1 text-small text-hint">{isDraft ? `${t.invitations.length} students to invite` : `${joined} of ${t.invitations.length} joined`}</p>
                    {!isDraft && pending.length > 0 && (
                      <ul className="mt-2 divide-y divide-line/70 text-small">
                        {pending.map((i) => (
                          <li key={i.invitation_id} className="py-1.5">
                            <p className="truncate">{i.invited_email}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1">
                              <CopyLink url={`${base}/invite/${i.invite_token}`} />
                              <ActionForm action={resendInviteAction.bind(null, i.invitation_id, projectId)} className="flex flex-wrap items-center gap-x-2">
                                <SubmitButton variant="ghost" small pendingText="Sending…" className="!border-0 !px-2.5 !py-1 !text-primary hover:!bg-primary-tint">
                                  Resend
                                </SubmitButton>
                              </ActionForm>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!isDraft && (
                      <Link href={`/instructor/teams/${t.team_id}`} className="link mt-auto inline-flex items-center gap-1 pt-3 text-small">
                        Open team <ArrowIcon />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          ))}

        {tab === "milestones" && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section>
              <p className="mb-3 text-small text-hint">Completing a milestone opens peer ratings for it.</p>
              {milestones.length === 0 ? (
                <EmptyState title="No milestones yet" />
              ) : (
                <ul className="space-y-2">
                  {milestones.map((m) => (
                    <li key={m.milestone_id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-semibold">{m.milestone_name}</p>
                        <p className="text-small text-hint">Due {formatDate(m.due_date, true)}</p>
                      </div>
                      {m.milestone_status === "completed" ? (
                        <Chip tone="confirmed">Complete</Chip>
                      ) : (
                        <ActionForm action={completeMilestoneAction.bind(null, m.milestone_id, projectId)}>
                          <SubmitButton variant="secondary" small pendingText="Saving…">
                            Mark complete
                          </SubmitButton>
                        </ActionForm>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <ActionForm action={addMilestoneAction.bind(null, projectId)} resetOnSuccess className="card h-fit space-y-3 p-4">
              <p className="font-semibold">Add a milestone</p>
              <Field label="Name" htmlFor="ms-name">
                <input id="ms-name" name="name" maxLength={100} placeholder="Milestone 3: Final report" className="field-input" />
              </Field>
              <Field label="Due date" htmlFor="ms-due">
                <input id="ms-due" name="dueDate" type="date" className="field-input" />
              </Field>
              <SubmitButton small pendingText="Adding…">
                Add milestone
              </SubmitButton>
            </ActionForm>
          </div>
        )}

        {tab === "settings" && (
          <div className="max-w-2xl space-y-6">
            <section className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Peer ratings</p>
                  <p className="text-small text-hint">{settings.anonymous ? "Anonymous: students never see who rated them." : "Named: students see who gave each rating."}</p>
                </div>
                <LinkButton href={`${href}/settings`} variant="secondary" small>
                  Change
                </LinkButton>
              </div>
            </section>
            {drafts.length > 0 && (
              <section className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Class list</p>
                    <p className="text-small text-hint">Replace the unpublished teams with a new list.</p>
                  </div>
                  <LinkButton href={`${href}/roster`} variant="secondary" small>
                    Replace list
                  </LinkButton>
                </div>
              </section>
            )}
            <DangerZone
              action={deleteProjectAction.bind(null, projectId)}
              thing="project"
              name={project.project_name}
              consequences={[
                `All ${teams.length} team ${teams.length === 1 ? "channel" : "channels"} in this project`,
                "Every work log entry, confirmation, dispute, rating, comment and flag in those teams",
                `The project's ${milestones.length} ${milestones.length === 1 ? "milestone" : "milestones"}, charters, tasks and invite links`,
              ]}
            />
            <p className="text-small text-hint">
              The course ({project.course_code} Section {project.section_number}) is kept so you can start a new project in it.
            </p>
          </div>
        )}
      </Page>
    </>
  );
}
