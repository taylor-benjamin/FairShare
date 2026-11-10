import { confirmRoleAction, saveCharterAction } from "@/app/actions/team";
import { handlePageError } from "@/components/access-denied";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Chip, Field, Notice, Page } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getCharter } from "@/lib/services/team-health";

export const metadata = { title: "Team charter" };

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
  const { charter, members, complete, canWrite } = data;
  const me = members.find((m) => m.user_id === user.userId);
  const confirmedCount = members.filter((m) => m.role_confirmed === 1).length;

  return (
    <Page narrow>
      {welcome && (
        <div className="mb-4">
          <Notice tone="success">
            Welcome to your team! Start by agreeing on a charter: your goals, how you&apos;ll work together, and who does what.
          </Notice>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-heading">Team charter</h2>
        {complete ? <Chip tone="confirmed">Complete</Chip> : <Chip tone="review">{confirmedCount} of {members.length} roles confirmed</Chip>}
      </div>

      {canWrite && me && me.team_role && me.role_confirmed === 0 && charter && (
        <div className="card mb-6 border-primary p-4">
          <p>
            Your team listed you as <strong>{me.team_role}</strong>. Confirm it so everyone knows what to expect.
          </p>
          <ActionForm action={confirmRoleAction.bind(null, teamId)} className="mt-3">
            <SubmitButton pendingText="Confirming…">Confirm my role</SubmitButton>
          </ActionForm>
        </div>
      )}

      {canWrite ? (
        <ActionForm action={saveCharterAction.bind(null, teamId)} className="space-y-5">
          <Field label="Team goals" htmlFor="goals" hint="What does success look like for your team?">
            <textarea id="goals" name="goals" rows={3} maxLength={2000} defaultValue={charter?.team_goals ?? ""} className="field-input" />
          </Field>
          <Field label="Expectations" htmlFor="expectations" hint="How fast you reply, how you handle deadlines, how you split work.">
            <textarea id="expectations" name="expectations" rows={4} maxLength={2000} defaultValue={charter?.expectations ?? ""} className="field-input" />
          </Field>
          <fieldset className="space-y-3">
            <legend className="text-small">Roles</legend>
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3">
                <label htmlFor={`role_${m.user_id}`} className="w-32 shrink-0 truncate text-small sm:w-40">
                  {m.first_name} {m.last_name}
                </label>
                <input id={`role_${m.user_id}`} name={`role_${m.user_id}`} defaultValue={m.team_role ?? ""} maxLength={50} placeholder="e.g. Documentation" className="field-input" />
                <span className="w-24 shrink-0 text-right">{m.role_confirmed ? <Chip tone="confirmed">Confirmed</Chip> : <Chip tone="pending">Not yet</Chip>}</span>
              </div>
            ))}
          </fieldset>
          <SubmitButton full pendingText="Saving…">
            Save charter
          </SubmitButton>
        </ActionForm>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="section-label">Team goals</p>
            <p className="mt-1 whitespace-pre-line">{charter?.team_goals ?? "Not written yet."}</p>
          </div>
          <div>
            <p className="section-label">Expectations</p>
            <p className="mt-1 whitespace-pre-line">{charter?.expectations ?? "Not written yet."}</p>
          </div>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-2 px-4 py-3">
                <span>
                  {m.first_name} {m.last_name} <span className="text-small text-hint">· {m.team_role ?? "no role yet"}</span>
                </span>
                {m.role_confirmed ? <Chip tone="confirmed">Confirmed</Chip> : <Chip tone="pending">Not yet</Chip>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Page>
  );
}
