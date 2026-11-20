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
  tone = "danger",
  menu = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  label: string;
  confirm: string;
  pendingText?: string;
  /** "danger" for removing things, "plain" for reversible steps like reopening the charter. */
  tone?: "danger" | "plain";
  /** Render as a row in a dropdown menu instead of a small button. */
  menu?: boolean;
}) {
  const [state, action] = useActionState(serverAction, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      className={menu ? "block" : "inline-flex items-center gap-2"}
    >
      {menu ? (
        <button className={`menu-item ${tone === "danger" ? "text-disputed hover:bg-disputed-soft" : ""}`}>{label}</button>
      ) : (
        <SubmitButton variant="ghost" small pendingText={pendingText} className={tone === "danger" ? "!border-0 !px-2.5 !py-1 !text-disputed hover:!bg-disputed-soft" : ""}>
          {label}
        </SubmitButton>
      )}
      {state.error && <span className="text-small text-disputed">{state.error}</span>}
    </form>
  );
}
