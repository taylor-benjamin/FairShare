"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms";
import { Field, Notice } from "@/components/ui";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, {});
  if (state.ok) {
    return (
      <div className="space-y-4">
        <Notice tone="success">{state.ok}</Notice>
        <p className="text-center text-small">
          <Link href="/login" className="link">
            Back to log in
          </Link>
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email" hint="The address you use to log in to FairShare.">
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} className="field-input" />
      </Field>
      {state.error && (
        <p className="text-small text-disputed" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton full pendingText="Sending…" className="sm:w-full">
        Email me a reset link
      </SubmitButton>
      <p className="text-center text-small">
        <Link href="/login" className="link">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
