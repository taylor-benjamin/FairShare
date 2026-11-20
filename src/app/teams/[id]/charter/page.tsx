import { agreeCharterAction, reopenCharterAction, saveCharterAction, saveRoleAction } from "@/app/actions/team";
import { handlePageError } from "@/components/access-denied";
import { ConfirmAction } from "@/components/confirm-action";
import { ActionForm, SubmitButton } from "@/components/forms";
import { LocalTime } from "@/components/local-time";
import { Chip, Field, Notice, Page } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { charterStatus } from "@/lib/rules";
import { getCharter } from "@/lib/services/team-health";

export const metadata = { title: "Team charter" };

function LockIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export default async function CharterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser();
  const teamId = Number((await params).id);
  const { welcome } = await searchParams;
  let data;
  try {
    data = await getCharter(user, teamId);
  } catch (e) {
    return handlePageError(e);
  }
  const { charter, members, locked, canWrite } = data;
  const me = members.find((m) => m.user_id === user.userId);
  const status = charterStatus(!!charter, members);
  const editable = canWrite && !locked;
  const needsMyAgreement = canWrite && !!charter && me?.charter_agreed !== 1;
  const teammates = members.filter((m) => m.user_id !== user.userId);

  return (
    <Page>
      {welcome && (
        <div className="mb-4">
          <Notice tone="success">
            Welcome to your team! Start by agreeing on a charter: your goals, how you&apos;ll work together, and who does what.
          </Notice>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-heading">Team charter</h2>
        <Chip tone={status.done ? "confirmed" : "review"}>{status.label}</Chip>
      </div>
      {charter?.updated_date && (
        <p className="mt-1 text-small text-hint">
          Last updated{charter.updated_by_first && ` by ${charter.updated_by_first} ${charter.updated_by_last}`} on <LocalTime iso={charter.updated_date} />
        </p>
      )}

      <div className="mt-5 grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      {/* Goals and expectations: everyone agrees, then they lock. */}
      <section className="card space-y-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="section-label">Goals and expectations</p>
          {locked && (
            <span className="inline-flex items-center gap-1 text-small text-hint">
              <LockIcon /> Locked
            </span>
          )}
        </div>

        {editable ? (
          <ActionForm action={saveCharterAction.bind(null, teamId)} className="space-y-4">
            <Field label="Team goals" htmlFor="goals">
              <textarea
                id="goals"
                name="goals"
                rows={3}
                maxLength={2000}
                defaultValue={charter?.team_goals ?? ""}
                placeholder="What does success look like for your team?"
                className="field-input"
              />
            </Field>
            <Field label="Expectations" htmlFor="expectations">
              <textarea
                id="expectations"
                name="expectations"
                rows={4}
                maxLength={2000}
                defaultValue={charter?.expectations ?? ""}
                placeholder="How fast you reply, how you handle deadlines, how you split work"
                className="field-input"
              />
            </Field>
            <SubmitButton variant={charter ? "secondary" : "primary"} pendingText="Saving…">
              {charter ? "Save changes" : "Save"}
            </SubmitButton>
            {charter && <p className="text-small text-hint">Saving changes asks everyone to agree again.</p>}
          </ActionForm>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-small text-hint">Team goals</p>
              <p className="mt-1 whitespace-pre-line">{charter?.team_goals ?? "Not written yet."}</p>
            </div>
            <div>
              <p className="text-small text-hint">Expectations</p>
              <p className="mt-1 whitespace-pre-line">{charter?.expectations ?? "Not written yet."}</p>
            </div>
          </div>
        )}

        {charter && (
          <div className="border-t border-line pt-4">
            <p className="text-small">Agreement</p>
            <ul className="mt-2 divide-y divide-line">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between gap-2 py-2 text-small">
                  <span className="min-w-0 truncate">
                    {m.first_name} {m.last_name}
                    {m.user_id === user.userId && <span className="text-hint"> (you)</span>}
                  </span>
                  {m.charter_agreed === 1 ? <Chip tone="confirmed">Agreed</Chip> : <Chip tone="pending">Waiting</Chip>}
                </li>
              ))}
            </ul>
            {needsMyAgreement && (
              <ActionForm action={agreeCharterAction.bind(null, teamId)} className="mt-3">
                <input type="hidden" name="version" value={charter.updated_date ?? ""} />
                <SubmitButton variant="confirm" full pendingText="Saving…">
                  Agree
                </SubmitButton>
              </ActionForm>
            )}
            {locked && canWrite && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-small text-hint">Need a change? Reopen it and everyone agrees again.</p>
                <ConfirmAction
                  action={reopenCharterAction.bind(null, teamId)}
                  label="Reopen"
                  tone="plain"
                  pendingText="Reopening…"
                  confirm="Reopen the charter for editing? Everyone will need to agree again."
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Roles: each student sets their own. */}
      <section className="card space-y-4 p-4 sm:p-5">
        <p className="section-label">Roles</p>
        {canWrite && (
          <ActionForm action={saveRoleAction.bind(null, teamId)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Field label="Your role" htmlFor="myRole">
                <input id="myRole" name="myRole" defaultValue={me?.team_role ?? ""} maxLength={50} placeholder="e.g. Project Lead or Documentation" className="field-input" />
              </Field>
            </div>
            <SubmitButton variant="secondary" pendingText="Saving…">
              Save role
            </SubmitButton>
          </ActionForm>
        )}
        {(canWrite ? teammates : members).length > 0 && (
          <ul className="divide-y divide-line">
            {(canWrite ? teammates : members).map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-2 py-2 text-small">
                <span className="min-w-0 truncate">
                  {m.first_name} {m.last_name}
                  {m.team_role && <span className="text-hint"> · {m.team_role}</span>}
                </span>
                {m.role_confirmed && m.team_role ? <Chip tone="confirmed">Set</Chip> : <Chip tone="pending">Not yet</Chip>}
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </Page>
  );
}
