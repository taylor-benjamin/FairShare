"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { SubmitButton } from "@/components/forms";

/** `action` is bound on the server (importRosterAction.bind(null, projectId)). */
export function RosterForm({ action: serverAction }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState> }) {
  const [state, action] = useActionState(serverAction, {});
  const [paste, setPaste] = useState(false);
  const problems = Object.values(state.fieldErrors ?? {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <label htmlFor="roster" className="block cursor-pointer rounded-xl border-2 border-dashed border-line p-6 text-center hover:border-primary has-[input:focus-visible]:border-primary">
        <span className="block font-semibold">Choose your class list (.csv)</span>
        <span className="mt-1 block text-small text-hint">In Moodle: Participants → Download → CSV. Add a team_name column if it isn&apos;t there.</span>
        <input id="roster" name="roster" type="file" accept=".csv,text/csv" className="mx-auto mt-3 block text-small file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:font-semibold file:text-white" />
      </label>

      <button type="button" className="text-small text-primary hover:underline" onClick={() => setPaste((p) => !p)}>
        {paste ? "Hide the paste box" : "Or paste the list instead"}
      </button>
      {paste && (
        <textarea
          name="pasted"
          rows={8}
          className="field-input font-mono text-small"
          placeholder={"first_name,last_name,email,team_name\nMarcus,Reed,marcus.reed@school.edu,Team Tigers"}
        />
      )}

      {state.error && (
        <div className="rounded-lg border border-disputed/30 bg-disputed-soft p-4" role="alert">
          <p className="font-semibold text-disputed">{state.error}</p>
          {problems.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-small text-disputed">
              {problems.slice(0, 15).map((p) => (
                <li key={p}>{p}</li>
              ))}
              {problems.length > 15 && <li>…and {problems.length - 15} more.</li>}
            </ul>
          )}
          <p className="mt-2 text-small text-ink">Fix these in your spreadsheet, save it as CSV, and upload it again. Nothing was created yet.</p>
        </div>
      )}
      <SubmitButton full pendingText="Checking your list…">
        Create team channels
      </SubmitButton>
    </form>
  );
}
