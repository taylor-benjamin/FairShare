// One clear action per project for the instructor ("Next step" card).
import { completeMilestoneAction } from "@/app/actions/instructor";
import type { NextStep } from "@/lib/rules";
import { ActionForm, SubmitButton } from "./forms";
import { LinkButton } from "./ui";

export function NextStepCard({ step, projectId }: { step: NonNullable<NextStep>; projectId: number }) {
  const project = `/instructor/projects/${projectId}`;
  const action =
    step.kind === "upload" ? (
      <LinkButton href={`${project}/roster`} small>
        Upload class list
      </LinkButton>
    ) : step.kind === "publish" ? (
      <LinkButton href={project} small>
        Review and publish
      </LinkButton>
    ) : step.kind === "add-milestone" ? (
      <LinkButton href={`${project}?tab=milestones`} small>
        Add milestone
      </LinkButton>
    ) : step.kind === "complete-milestone" ? (
      <ActionForm action={completeMilestoneAction.bind(null, step.milestoneId, projectId)}>
        <SubmitButton small pendingText="Saving…">
          Mark complete
        </SubmitButton>
      </ActionForm>
    ) : (
      <LinkButton href={project} small>
        Send links
      </LinkButton>
    );

  return (
    <div className="flex flex-col gap-3 rounded-(--radius-card) border border-secondary/30 bg-secondary-tint p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-secondary" />
        <div>
          <p className="text-small font-semibold text-secondary-ink">Next step</p>
          <p>{step.title}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
