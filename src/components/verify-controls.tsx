"use client";

import { useActionState, useState } from "react";
import { verifyAction } from "@/app/actions/team";
import { SubmitButton } from "./forms";
import { Button } from "./ui";

/** Confirm in one tap; Dispute opens a reason box (a reason is required). */
export function VerifyControls({ contributionId, teamId }: { contributionId: number; teamId: number }) {
  const [state, action] = useActionState(verifyAction.bind(null, contributionId, teamId), {});
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);

  if (state.ok) return <p className="mt-3 text-small text-confirmed">{state.ok}</p>;

  return (
    <form
      action={action}
      className="mt-3"
      onSubmit={(e) => {
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.value === "dispute" && !reason.trim()) {
          e.preventDefault();
          setTried(true);
        }
      }}
    >
      {!disputing ? (
        <div className="flex gap-2">
          <SubmitButton variant="confirm" small name="decision" value="confirm" pendingText="Confirming…">
            Confirm
          </SubmitButton>
          <Button type="button" variant="dispute" small onClick={() => setDisputing(true)}>
            Dispute
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor={`reason-${contributionId}`} className="block text-small">
            Why are you disputing this? Your instructor will see your reason.
          </label>
          <textarea
            id={`reason-${contributionId}`}
            name="reason"
            rows={2}
            maxLength={255}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={tried && !reason.trim()}
            className="field-input"
            placeholder="e.g. Jordan wrote half of it."
            autoFocus
          />
          {tried && !reason.trim() && <p className="text-small text-disputed">Add a reason so your instructor can review it.</p>}
          <div className="flex gap-2">
            <SubmitButton variant="dispute" small name="decision" value="dispute" pendingText="Sending…">
              Send dispute
            </SubmitButton>
            <Button type="button" variant="secondary" small onClick={() => setDisputing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {state.error && <p className="mt-2 text-small text-disputed">{state.error}</p>}
    </form>
  );
}
