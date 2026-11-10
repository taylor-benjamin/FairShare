"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, signupAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} className="field-input" />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field-input" />
      </Field>
      {state.error && (
        <p className="text-small text-disputed" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton full pendingText="Logging in…" className="sm:w-full">
        Log in
      </SubmitButton>
      <p className="text-center text-small text-hint">
        New instructor or viewer?{" "}
        <Link href="/signup" className="link">
          Create an account
        </Link>
        <br />
        Students: use the invite link your instructor emailed you.
      </p>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signupAction, {});
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <fieldset className="space-y-2">
        <legend className="text-small">I am…</legend>
        <label className="flex items-start gap-3 rounded-lg border border-line p-3 has-checked:border-primary has-checked:bg-primary-soft">
          <input type="radio" name="role" value="instructor" defaultChecked={v.role !== "viewer"} className="mt-1 accent-primary" />
          <span>
            <span className="font-semibold">An instructor</span>
            <span className="block text-small text-hint">Set up team channels for a class and review results.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-line p-3 has-checked:border-primary has-checked:bg-primary-soft">
          <input type="radio" name="role" value="viewer" defaultChecked={v.role === "viewer"} className="mt-1 accent-primary" />
          <span>
            <span className="font-semibold">A viewer</span>
            <span className="block text-small text-hint">Read team channels that have been shared publicly. Read-only.</span>
          </span>
        </label>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" htmlFor="firstName">
          <input id="firstName" name="firstName" autoComplete="given-name" defaultValue={v.firstName} className="field-input" maxLength={50} />
        </Field>
        <Field label="Last name" htmlFor="lastName">
          <input id="lastName" name="lastName" autoComplete="family-name" defaultValue={v.lastName} className="field-input" maxLength={50} />
        </Field>
      </div>
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} className="field-input" maxLength={100} />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters.">
        <input id="password" name="password" type="password" autoComplete="new-password" className="field-input" />
      </Field>
      {state.error && (
        <p className="text-small text-disputed" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton full pendingText="Creating account…" className="sm:w-full">
        Create account
      </SubmitButton>
      <p className="text-center text-small text-hint">
        Already have an account?{" "}
        <Link href="/login" className="link">
          Log in
        </Link>
      </p>
    </form>
  );
}
