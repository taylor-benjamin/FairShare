"use client";

import { useActionState, useRef, useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { SubmitButton } from "./forms";
import { Button } from "./ui";

/**
 * Permanent-delete control. Collapsed by default; once opened it lists what will be removed and
 * keeps the red button disabled until the exact name is typed. The server re-checks the name.
 * `action` is bound on the server (e.g. deleteTeamAction.bind(null, teamId)).
 */
export function DangerZone({
  action: serverAction,
  thing,
  name,
  consequences,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  thing: "project" | "team";
  name: string;
  consequences: string[];
}) {
  const [state, action] = useActionState(serverAction, {});
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();
  const inputId = `confirm-delete-${thing}`;

  return (
    <section aria-labelledby={`${inputId}-title`} className="rounded-(--radius-card) border border-disputed/30 bg-surface p-4 sm:p-5">
      <h3 id={`${inputId}-title`} className="font-semibold text-disputed">
        Delete this {thing}
      </h3>
      <p className="mt-1 text-small text-hint">This can&apos;t be undone.</p>

      {/* Native <details>: opens without JavaScript, and the form is always in the page. */}
      <details ref={detailsRef} className="group mt-3">
        <summary className="inline-flex cursor-pointer list-none items-center rounded-(--radius-control) border border-disputed/50 bg-surface px-3.5 py-1.5 text-small font-semibold text-disputed transition hover:border-disputed hover:bg-disputed-soft group-open:hidden [&::-webkit-details-marker]:hidden">
          Delete {thing}…
        </summary>
        <form action={action} className="space-y-3" noValidate>
          <div className="rounded-xl bg-disputed-soft/60 p-3 text-small">
            <p className="font-semibold text-ink">Deleting “{name}” permanently removes:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink">
              {consequences.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-hint">Student accounts are kept, so they can still use other teams.</p>
          </div>
          <div className="space-y-1">
            <label htmlFor={inputId} className="block text-small">
              Type <span className="font-semibold">{name}</span> to confirm
            </label>
            <input
              id={inputId}
              name="confirmName"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="field-input"
              aria-invalid={typed.length > 0 && !matches}
            />
          </div>
          {state.error && (
            <p className="text-small text-disputed" role="alert">
              {state.error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              small
              onClick={() => {
                if (detailsRef.current) detailsRef.current.open = false;
                setTyped("");
              }}
            >
              Cancel
            </Button>
            {/* Disabled until the name matches; the server checks again. */}
            <DeleteButton disabled={!matches} thing={thing} />
          </div>
        </form>
      </details>
    </section>
  );
}

function DeleteButton({ disabled, thing }: { disabled: boolean; thing: string }) {
  return disabled ? (
    <Button type="button" small disabled className="!border-disputed !bg-disputed !text-white !shadow-none">
      Permanently delete {thing}
    </Button>
  ) : (
    <SubmitButton small pendingText="Deleting…" className="!border-disputed !bg-disputed !shadow-none hover:!bg-red-700">
      Permanently delete {thing}
    </SubmitButton>
  );
}
