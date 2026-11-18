"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";
import { SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";

/** `action` is bound on the server (resetPasswordAction.bind(null, token)). */
export function ResetPasswordForm({ action: serverAction, email }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState>; email: string }) {
  const [state, action] = useActionState(serverAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      {/* Lets password managers save the new password against the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <Field label="New password" htmlFor="password" hint="At least 8 characters.">
        <PasswordInput id="password" autoComplete="new-password" />
      </Field>
      <Field label="Type it again" htmlFor="confirm">
        <PasswordInput id="confirm" autoComplete="new-password" />
      </Field>
      {state.error && (
        <p className="text-small text-disputed" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton full pendingText="Saving…" className="sm:w-full">
        Save password
      </SubmitButton>
    </form>
  );
}
