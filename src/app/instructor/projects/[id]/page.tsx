import Link from "next/link";
import { addMilestoneAction, completeMilestoneAction, deleteProjectAction, publishAction, resendInviteAction } from "@/app/actions/instructor";
import { appUrl } from "@/app/actions/helpers";
import { CopyLink } from "@/components/copy-link";
import { DangerZone } from "@/components/danger-zone";
import { DatePicker } from "@/components/date-picker";
import { MoreMenu } from "@/components/more-menu";
import { handlePageError } from "@/components/access-denied";
import { ActionForm, SubmitButton } from "@/components/forms";
import { NextStepCard } from "@/components/next-step";
import { Stepper } from "@/components/stepper";
import { ArrowIcon, Chip, EmptyState, Field, formatDate, HeaderBar, LinkButton, Notice, Page, PageTabs, Panel } from "@/components/ui";
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

        {tab === "teams" && (
          <Panel title="Teams" tone="primary" menus count={teams.length} empty="No teams yet. Upload your class list to create them.">
            {teams.map((t) => {
              const joined = t.invitations.filter((i) => i.invite_status === "accepted").length;
              const pending = t.invitations.filter((i) => i.invite_status === "pending");
              const isDraft = t.channel_status === "draft";
              return (
                <li key={t.team_id} className="px-4 py-3.5 sm:px-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{t.team_name}</span>
                        <Chip tone={isDraft || t.channel_status === "finished" ? "pending" : "confirmed"}>
                          {isDraft ? "Draft" : t.channel_status === "finished" ? "Finished" : "Active"}
                        </Chip>
                      </span>
                      <span className={`block text-small ${!isDraft && pending.length > 0 ? "text-secondary-ink" : "text-hint"}`}>
                        {isDraft ? `${t.invitations.length} students to invite` : `${joined} of ${t.invitations.length} joined`}
                      </span>
                    </span>
                    {!isDraft && (
                      <Link href={`/instructor/teams/${t.team_id}`} className="link inline-flex shrink-0 items-center gap-1 text-small">
                        Open team <ArrowIcon />
                      </Link>
                    )}
                  </div>
                  {!isDraft && pending.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {pending.map((i) => (
                        <li key={i.invitation_id} className="flex items-center justify-between gap-2 rounded-xl bg-secondary-tint py-1.5 pr-1.5 pl-3 text-small">
                          <span className="min-w-0 truncate">{i.invited_email}</span>
                          <span className="flex shrink-0 items-center">
                            <CopyLink url={`${base}/invite/${i.invite_token}`} />
                            <MoreMenu label={`Invite actions for ${i.invited_email}`}>
                              <ActionForm action={resendInviteAction.bind(null, i.invitation_id, projectId)}>
                                <button className="menu-item">Resend email</button>
                              </ActionForm>
                            </MoreMenu>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </Panel>
        )}

        {tab === "milestones" && (
          <div className="grid items-start gap-4 sm:gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Panel title="Milestones" tone="primary" count={milestones.length} empty="No milestones yet. Add the first one.">
              {milestones.map((m) => (
                <li key={m.milestone_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                  <span className="min-w-0">
                    <span className="block font-semibold">{m.milestone_name}</span>
                    <span className="block text-small text-hint">Due {formatDate(m.due_date, true)}</span>
                  </span>
                  {m.milestone_status === "completed" ? (
                    <Chip tone="confirmed">Complete · ratings open</Chip>
                  ) : (
                    <ActionForm action={completeMilestoneAction.bind(null, m.milestone_id, projectId)}>
                      <SubmitButton variant="secondary" small pendingText="Saving…">
                        Mark complete
                      </SubmitButton>
                    </ActionForm>
                  )}
                </li>
              ))}
            </Panel>
            <section className="card">
              <div className="card-head rounded-t-(--radius-card) bg-secondary-tint">
                <h2 className="flex items-center gap-2">
                  <span aria-hidden className="size-2 rounded-full bg-secondary" />
                  Add a milestone
                </h2>
              </div>
              <ActionForm action={addMilestoneAction.bind(null, projectId)} resetOnSuccess className="space-y-3 p-4 sm:p-5">
                <Field label="Name" htmlFor="ms-name">
                  <input id="ms-name" name="name" maxLength={100} placeholder="Milestone 3: Final report" className="field-input" />
                </Field>
                <Field label="Due date" htmlFor="ms-due">
                  <DatePicker id="ms-due" name="dueDate" />
                </Field>
                <p className="text-small text-hint">Completing a milestone opens peer ratings for it.</p>
                <SubmitButton full pendingText="Adding…">
                  Add milestone
                </SubmitButton>
              </ActionForm>
            </section>
          </div>
        )}

        {tab === "settings" && (
          <div className="grid items-start gap-4 sm:gap-6 md:grid-cols-2">
            <div className="space-y-4 sm:space-y-6">
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
            </div>
            <div className="space-y-2">
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
          </div>
        )}
      </Page>
    </>
  );
}
