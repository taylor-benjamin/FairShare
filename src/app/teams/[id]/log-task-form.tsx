"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";

/** P09 — the under-a-minute log form. Only "What did you do?" is required; today's date is pre-filled. */
/** Today's date on the student's own device (YYYY-MM-DD), not the server's UTC date. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function LogTaskForm({ action: serverAction, tasks }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState>; tasks: { task_id: number; task_title: string }[] }) {
  // `action` is bound on the server (logTaskAction.bind(null, teamId)) so the team id can't be altered in the browser.
  const [state, action] = useActionState(serverAction, {});
  const ref = useRef<HTMLFormElement>(null);
  const [taskId, setTaskId] = useState("");
  // Filled in on the device after it loads, so the default is the student's local "today".
  const [today, setToday] = useState("");
  const [date, setDate] = useState("");
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};

  useEffect(() => {
    const t = localToday();
    setToday(t);
    setDate((d) => d || t);
  }, []);

  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      setTaskId("");
      setDate(localToday());
    }
  }, [state.stamp, state.ok]);

  return (
    <form ref={ref} action={action} className="space-y-4" noValidate>
      <p className="section-label">Log a completed task</p>
      <Field label="What did you do?" htmlFor="description" hint="One line is enough." error={fe.description}>
        <input
          id="description"
          name="description"
          className="field-input"
          placeholder="Drafted the ERD for milestone 2"
          maxLength={255}
          defaultValue={v.description}
          key={`d-${state.stamp ?? 0}`}
          aria-invalid={!!fe.description}
          aria-describedby={fe.description ? "description-error" : "description-hint"}
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Hours" htmlFor="hours" error={fe.hours}>
          <input
            id="hours"
            name="hours"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0.5"
            max="24"
            className="field-input"
            placeholder="2.5"
            defaultValue={v.hours}
            key={`h-${state.stamp ?? 0}`}
            aria-invalid={!!fe.hours}
          />
        </Field>
        <Field label="Completed on" htmlFor="completionDate" error={fe.completionDate}>
          <input
            id="completionDate"
            name="completionDate"
            type="date"
            max={today || undefined}
            className="field-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={!!fe.completionDate}
          />
        </Field>
      </div>
      {tasks.length > 0 && (
        <Field label="Planned task (optional)" htmlFor="taskId" error={fe.taskId} hint="Link it if this work was one of your team's planned tasks.">
          <select id="taskId" name="taskId" className="field-input" value={taskId} onChange={(e) => setTaskId(e.target.value)} aria-invalid={!!fe.taskId}>
            <option value="">Not a planned task</option>
            {tasks.map((t) => (
              <option key={t.task_id} value={t.task_id}>
                {t.task_title}
              </option>
            ))}
          </select>
        </Field>
      )}
      {taskId && (
        <label className="flex items-center gap-2 text-small">
          <input type="checkbox" name="finishesTask" defaultChecked className="h-4 w-4 accent-primary" />
          This finishes the task
        </label>
      )}
      <SubmitButton full pendingText="Logging…">
        Log task
      </SubmitButton>
      {state.ok && (
        <p className="text-small text-confirmed" role="status">
          {state.ok}
        </p>
      )}
      {state.error && (
        <p className="text-small text-disputed" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
