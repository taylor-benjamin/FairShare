import { addTaskAction, answerDeleteRequestAction, cancelDeleteRequestAction, deleteTaskAction, reassignTaskAction, taskStatusAction } from "@/app/actions/team";
import { ConfirmAction } from "@/components/confirm-action";
import { handlePageError } from "@/components/access-denied";
import { ActionForm, SubmitButton } from "@/components/forms";
import { DatePicker } from "@/components/date-picker";
import { MoreMenu } from "@/components/more-menu";
import { EmptyState, Field, formatDate, Page } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getChannel } from "@/lib/services/contribution-service";
import { getTaskHistory } from "@/lib/services/team-health";
import { TaskHistoryList } from "@/components/task-history";
import type { TaskStatus } from "@/lib/types";

export const metadata = { title: "Tasks" };

/** The three buckets, with the moves each task can make from there. */
const buckets: { status: TaskStatus; label: string; dot: string; bg: string; moves: { to: TaskStatus; label: string; primary?: boolean }[] }[] = [
  { status: "to_do", label: "To do", dot: "bg-hint", bg: "bg-wash", moves: [{ to: "in_progress", label: "Start", primary: true }, { to: "done", label: "Mark done" }] },
  { status: "in_progress", label: "In progress", dot: "bg-primary", bg: "bg-primary-tint", moves: [{ to: "done", label: "Mark done", primary: true }, { to: "to_do", label: "Move to To do" }] },
  { status: "done", label: "Done", dot: "bg-confirmed", bg: "bg-confirmed-soft/45", moves: [{ to: "in_progress", label: "Reopen", primary: true }] },
];

export default async function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const teamId = Number((await params).id);
  let channel, history;
  try {
    [channel, history] = await Promise.all([getChannel(user, teamId), getTaskHistory(user, teamId)]);
  } catch (e) {
    return handlePageError(e);
  }
  const { tasks, members, canWrite } = channel;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Page>
      {canWrite && (
        <ActionForm action={addTaskAction.bind(null, teamId)} resetOnSuccess className="card mb-6 p-4">
          <h2 className="mb-3 font-semibold">Add a task</h2>
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
              <DatePicker id="dueDate" name="dueDate" clearable placeholder="No due date" />
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
            const primary = b.moves.find((m) => m.primary);
            const others = b.moves.filter((m) => !m.primary);
            return (
              <section key={b.status} aria-labelledby={`bucket-${b.status}`} className={`rounded-(--radius-card) p-2.5 sm:p-3 ${b.bg}`}>
                <h2 id={`bucket-${b.status}`} className="mb-2.5 flex items-center gap-2 px-1.5 pt-1 text-small font-semibold">
                  <span aria-hidden className={`size-2 rounded-full ${b.dot}`} />
                  {b.label}
                  <span className="font-normal text-hint">{inBucket.length}</span>
                </h2>
                {inBucket.length === 0 ? (
                  <p className="px-1.5 pb-1.5 text-small text-hint">Nothing here.</p>
                ) : (
                  <ul className="space-y-2">
                    {inBucket.map((t) => {
                      const overdue = b.status !== "done" && !!t.due_date && t.due_date.slice(0, 10) < today;
                      const canReassign = canWrite && t.user_id !== null && members.length > 1;
                      const canDelete = (t.deleteMode === "delete" && !t.canAnswerDelete) || (t.deleteMode === "request" && !t.deletePending);
                      const hasMenu = canWrite && (others.length > 0 || canReassign || canDelete);
                      return (
                        <li key={t.task_id} className="card p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`font-semibold ${b.status === "done" ? "text-hint line-through decoration-1" : ""}`}>{t.task_title}</p>
                              <p className="text-small text-hint">
                                {t.owner_first ? `${t.owner_first} ${t.owner_last}` : "Unassigned"}
                                {t.due_date && (
                                  <>
                                    {" · "}
                                    <span className={overdue ? "font-semibold text-disputed" : ""}>
                                      {overdue ? "overdue" : "due"} {formatDate(t.due_date)}
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                            {hasMenu && (
                              <MoreMenu label={`More actions for ${t.task_title}`}>
                                {others.length > 0 && (
                                  <ActionForm action={taskStatusAction.bind(null, t.task_id, teamId)}>
                                    {others.map((mv) => (
                                      <button key={mv.to} name="status" value={mv.to} className="menu-item">
                                        {mv.label}
                                      </button>
                                    ))}
                                  </ActionForm>
                                )}
                                {canReassign && (
                                  <details>
                                    <summary className="menu-item list-none [&::-webkit-details-marker]:hidden">Reassign</summary>
                                    <ActionForm action={reassignTaskAction.bind(null, t.task_id, teamId)} resetOnSuccess className="space-y-2.5 px-3 pt-1 pb-2">
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
                                {t.deleteMode === "delete" && !t.canAnswerDelete && (
                                  <ConfirmAction menu action={deleteTaskAction.bind(null, t.task_id, teamId)} label="Delete task" confirm={`Delete "${t.task_title}"? This can't be undone.`} />
                                )}
                                {t.deleteMode === "request" && !t.deletePending && (
                                  <ConfirmAction
                                    menu
                                    action={deleteTaskAction.bind(null, t.task_id, teamId)}
                                    label="Ask to delete"
                                    confirm={`${t.owner_first} owns "${t.task_title}". Ask them to approve deleting it?`}
                                  />
                                )}
                              </MoreMenu>
                            )}
                          </div>

                          {t.deletePending && (
                            <div className="mt-3 rounded-xl bg-disputed-soft p-3 text-small">
                              {t.canAnswerDelete ? (
                                <>
                                  <p>{t.requester_first} asked to delete this task.</p>
                                  <ActionForm action={answerDeleteRequestAction.bind(null, t.task_id, teamId)} className="mt-2 flex flex-wrap gap-2">
                                    <SubmitButton name="decision" value="approve" variant="secondary" small>
                                      Approve delete
                                    </SubmitButton>
                                    <SubmitButton name="decision" value="decline" variant="ghost" small>
                                      Decline
                                    </SubmitButton>
                                  </ActionForm>
                                </>
                              ) : t.isMyDeleteRequest ? (
                                <>
                                  <p>Waiting for {t.owner_first} to approve deleting it.</p>
                                  <ActionForm action={cancelDeleteRequestAction.bind(null, t.task_id, teamId)} className="mt-2">
                                    <SubmitButton variant="ghost" small>
                                      Cancel request
                                    </SubmitButton>
                                  </ActionForm>
                                </>
                              ) : (
                                <p>
                                  {t.requester_first} asked {t.owner_first} to delete this task.
                                </p>
                              )}
                            </div>
                          )}

                          {canWrite && primary && (
                            <ActionForm action={taskStatusAction.bind(null, t.task_id, teamId)} className="mt-3">
                              <SubmitButton name="status" value={primary.to} variant={b.status === "done" ? "ghost" : "secondary"} small>
                                {primary.label}
                              </SubmitButton>
                            </ActionForm>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <details className="card mt-6 overflow-hidden">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2 font-semibold">
              Task history
              <span className="rounded-full bg-wash px-2 py-0.5 text-small font-normal text-hint">{history.length}</span>
            </span>
            <span className="text-small text-primary">Show</span>
          </summary>
          <div className="border-t border-line p-4 sm:p-5">
            <TaskHistoryList items={history} viewer="student" />
          </div>
        </details>
      )}
    </Page>
  );
}
