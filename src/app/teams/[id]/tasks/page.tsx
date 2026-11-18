import { addTaskAction, reassignTaskAction, taskStatusAction } from "@/app/actions/team";
import { handlePageError } from "@/components/access-denied";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState, Field, formatDate, Page } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getChannel } from "@/lib/services/contribution-service";
import { getReassignments } from "@/lib/services/team-health";
import type { TaskStatus } from "@/lib/types";

export const metadata = { title: "Tasks" };

/** The three buckets, with the moves each task can make from there. */
const buckets: { status: TaskStatus; label: string; dot: string; moves: { to: TaskStatus; label: string; primary?: boolean }[] }[] = [
  { status: "to_do", label: "To do", dot: "bg-hint", moves: [{ to: "in_progress", label: "Start", primary: true }, { to: "done", label: "Done" }] },
  { status: "in_progress", label: "In progress", dot: "bg-primary", moves: [{ to: "done", label: "Done", primary: true }, { to: "to_do", label: "Not started" }] },
  { status: "done", label: "Done", dot: "bg-confirmed", moves: [{ to: "in_progress", label: "Reopen" }] },
];

export default async function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const teamId = Number((await params).id);
  let channel, history;
  try {
    [channel, history] = await Promise.all([getChannel(user, teamId), getReassignments(user, teamId)]);
  } catch (e) {
    return handlePageError(e);
  }
  const { tasks, members, canWrite } = channel;

  return (
    <Page>
      {canWrite && (
        <ActionForm action={addTaskAction.bind(null, teamId)} resetOnSuccess className="card mb-6 p-4">
          <p className="section-label mb-3">Add a task</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <Field label="Task" htmlFor="title">
              <input id="title" name="title" maxLength={100} placeholder="e.g. Usability test script" className="field-input" />
            </Field>
            <Field label="Owner" htmlFor="ownerId">
              <select id="ownerId" name="ownerId" className="field-input" defaultValue={String(user.userId)}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.first_name} {m.last_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due date (optional)" htmlFor="dueDate">
              <input id="dueDate" name="dueDate" type="date" className="field-input" />
            </Field>
            <SubmitButton full pendingText="Adding…">
              Add task
            </SubmitButton>
          </div>
        </ActionForm>
      )}

      {tasks.length === 0 ? (
        <EmptyState title="No planned tasks yet">Add the big pieces of work so everyone knows who owns what.</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {buckets.map((b) => {
            const inBucket = tasks.filter((t) => t.task_status === b.status);
            return (
              <section key={b.status} aria-labelledby={`bucket-${b.status}`} className="rounded-(--radius-card) bg-wash p-3">
                <h2 id={`bucket-${b.status}`} className="mb-3 flex items-center gap-2 px-1 text-small font-semibold">
                  <span aria-hidden className={`size-2 rounded-full ${b.dot}`} />
                  {b.label}
                  <span className="font-normal text-hint">{inBucket.length}</span>
                </h2>
                {inBucket.length === 0 ? (
                  <p className="px-1 pb-1 text-small text-hint">Nothing here.</p>
                ) : (
                  <ul className="space-y-2">
                    {inBucket.map((t) => (
                      <li key={t.task_id} className="card p-3.5">
                        <p className={`font-semibold ${b.status === "done" ? "text-hint line-through decoration-1" : ""}`}>{t.task_title}</p>
                        <p className="text-small text-hint">
                          {t.owner_first ? `${t.owner_first} ${t.owner_last}` : "Unassigned"}
                          {t.due_date && ` · due ${formatDate(t.due_date)}`}
                        </p>
                        {canWrite && (
                          <ActionForm action={taskStatusAction.bind(null, t.task_id, teamId)} className="mt-3 flex flex-wrap gap-2">
                            {b.moves.map((mv) => (
                              <SubmitButton key={mv.to} name="status" value={mv.to} variant={mv.primary ? "secondary" : "ghost"} small>
                                {mv.label}
                              </SubmitButton>
                            ))}
                          </ActionForm>
                        )}
                        {canWrite && t.user_id !== null && members.length > 1 && (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-small text-hint">Reassign</summary>
                            <ActionForm action={reassignTaskAction.bind(null, t.task_id, teamId)} resetOnSuccess className="mt-3 space-y-3">
                              <Field label="Give it to" htmlFor={`to-${t.task_id}`}>
                                <select id={`to-${t.task_id}`} name="toUserId" className="field-input">
                                  {members
                                    .filter((m) => m.user_id !== t.user_id)
                                    .map((m) => (
                                      <option key={m.user_id} value={m.user_id}>
                                        {m.first_name} {m.last_name}
                                      </option>
                                    ))}
                                </select>
                              </Field>
                              <Field label="Reason" htmlFor={`reason-${t.task_id}`}>
                                <input id={`reason-${t.task_id}`} name="reason" maxLength={255} placeholder="Your team and instructor see this" className="field-input" />
                              </Field>
                              <SubmitButton variant="secondary" small pendingText="Saving…">
                                Reassign task
                              </SubmitButton>
                            </ActionForm>
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8 max-w-3xl">
          <p className="section-label mb-3">Reassignment history</p>
          <ul className="space-y-2">
            {history.map((r) => (
              <li key={r.reassignment_id} className="rounded-xl bg-wash p-3.5 text-small">
                <span className="font-semibold">{r.task_title}</span>: {r.from_name} → {r.to_name} · {formatDate(r.reassigned_date)}
                <span className="block text-hint">
                  {r.by_role === "instructor" ? "By your instructor" : `By ${r.by_name}`}: {r.reassignment_reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Page>
  );
}
