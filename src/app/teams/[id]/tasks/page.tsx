import { addTaskAction, taskStatusAction } from "@/app/actions/team";
import { handlePageError } from "@/components/access-denied";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Chip, EmptyState, Field, formatDate, Page } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getChannel } from "@/lib/services/contribution-service";
import { getReassignments } from "@/lib/services/team-health";

export const metadata = { title: "Tasks" };

const statusLabel = { to_do: "To do", in_progress: "In progress", done: "Done" } as const;
const statusTone = { to_do: "pending", in_progress: "review", done: "confirmed" } as const;

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
      <div className="grid gap-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section>
          <p className="section-label mb-3">Team tasks</p>
          {tasks.length === 0 ? (
            <EmptyState title="No planned tasks yet">Add the big pieces of work so everyone knows who owns what.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {tasks.map((t) => (
                <li key={t.task_id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{t.task_title}</p>
                      <p className="text-small text-hint">
                        {t.owner_first ? `${t.owner_first} ${t.owner_last}` : "Unassigned"}
                        {t.due_date && ` · due ${formatDate(t.due_date)}`}
                      </p>
                    </div>
                    <Chip tone={statusTone[t.task_status]}>{statusLabel[t.task_status]}</Chip>
                  </div>
                  {canWrite && (
                    <ActionForm action={taskStatusAction.bind(null, t.task_id, teamId)} className="mt-3 flex items-center gap-2">
                      <label htmlFor={`status-${t.task_id}`} className="sr-only">
                        Status
                      </label>
                      <select id={`status-${t.task_id}`} name="status" defaultValue={t.task_status} className="field-input w-auto py-1.5 text-small">
                        <option value="to_do">To do</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                      <SubmitButton variant="secondary" small pendingText="Saving…">
                        Update
                      </SubmitButton>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          )}

          {history.length > 0 && (
            <div className="mt-8">
              <p className="section-label mb-3">Reassigned by your instructor</p>
              <ul className="space-y-2">
                {history.map((r) => (
                  <li key={r.reassignment_id} className="rounded-xl bg-wash p-3.5 text-small">
                    <span className="font-semibold">{r.task_title}</span>: {r.from_name} → {r.to_name} · {formatDate(r.reassigned_date)}
                    <span className="block text-hint">{r.reassignment_reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {canWrite && (
          <section>
            <ActionForm action={addTaskAction.bind(null, teamId)} resetOnSuccess className="card space-y-4 p-4">
              <p className="section-label">Add a task</p>
              <Field label="Task" htmlFor="title" hint="A piece of work someone will own, e.g. “Usability test script”.">
                <input id="title" name="title" maxLength={100} className="field-input" />
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
            </ActionForm>
          </section>
        )}
      </div>
    </Page>
  );
}
