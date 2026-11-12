"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";
import { SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";

/** `action` is bound on the server (acceptInviteAction.bind(null, token)). */
export function AcceptInviteForm({ action: serverAction, email, hasAccount }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState>; email: string; hasAccount: boolean }) {
  const [state, action] = useActionState(serverAction, {});
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email" hint="From your instructor's class list.">
        <input id="email" value={email} readOnly className="field-input bg-wash" />
      </Field>
      {!hasAccount && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" htmlFor="firstName">
            <input id="firstName" name="firstName" autoComplete="given-name" defaultValue={v.firstName} className="field-input" maxLength={50} />
          </Field>
          <Field label="Last name" htmlFor="lastName">
            <input id="lastName" name="lastName" autoComplete="family-name" defaultValue={v.lastName} className="field-input" maxLength={50} />
          </Field>
        </div>
      )}
      <Field
        label={hasAccount ? "Your FairShare password" : "Choose a password"}
        htmlFor="password"
        hint={hasAccount ? "Use your existing FairShare password." : "At least 8 characters."}
      >
        <input id="password" name="password" type="password" autoComplete={hasAccount ? "current-password" : "new-password"} className="field-input" />
      </Field>
      {state.error && (
        <p className="text-small text-disputed" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton full pendingText="Joining…" className="sm:w-full">
        Join team
      </SubmitButton>
    </form>
  );
}
