"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";
import { SubmitButton } from "./forms";

/** A small button that asks "Are you sure?" before running a server action (bound on the server). */
export function ConfirmAction({
  action: serverAction,
  label,
  confirm,
  pendingText = "…",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  label: string;
  confirm: string;
  pendingText?: string;
}) {
  const [state, action] = useActionState(serverAction, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      className="inline-flex items-center gap-2"
    >
      <SubmitButton variant="ghost" small pendingText={pendingText} className="!border-0 !px-2.5 !py-1 !text-disputed hover:!bg-disputed-soft">
        {label}
      </SubmitButton>
      {state.error && <span className="text-small text-disputed">{state.error}</span>}
    </form>
  );
}
