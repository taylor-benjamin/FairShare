"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "./ui";
import type { ActionState } from "@/lib/action-state";

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  full,
  small,
  name,
  value,
  className = "",
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "confirm" | "dispute" | "ghost";
  full?: boolean;
  small?: boolean;
  name?: string;
  value?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`${buttonClass(variant, { full, small })} ${className}`}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/**
 * A form bound to a server action. Shows the action's error or success message under the fields.
 * Children may be a render function to read field errors.
 */
export function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess = false,
  id,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode | ((state: ActionState) => ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
  id?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className} id={id} noValidate>
      {typeof children === "function" ? children(state) : children}
      {state.error && (
        <p className="mt-2 text-small text-disputed" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="mt-2 text-small text-confirmed" role="status">
          {state.ok}
        </p>
      )}
    </form>
  );
}
