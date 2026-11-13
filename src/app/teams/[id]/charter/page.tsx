import { saveCharterAction } from "@/app/actions/team";
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
  const setCount = members.filter((m) => m.role_confirmed === 1 && m.team_role).length;
  const teammates = members.filter((m) => m.user_id !== user.userId);

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
        {complete ? <Chip tone="confirmed">Complete</Chip> : <Chip tone="review">{setCount} of {members.length} roles set</Chip>}
      </div>


      {canWrite ? (
        <ActionForm action={saveCharterAction.bind(null, teamId)} className="space-y-5">
          <Field label="Team goals" htmlFor="goals" hint="What does success look like for your team?">
            <textarea id="goals" name="goals" rows={3} maxLength={2000} defaultValue={charter?.team_goals ?? ""} className="field-input" />
          </Field>
          <Field label="Expectations" htmlFor="expectations" hint="How fast you reply, how you handle deadlines, how you split work.">
            <textarea id="expectations" name="expectations" rows={4} maxLength={2000} defaultValue={charter?.expectations ?? ""} className="field-input" />
          </Field>
          <Field label="Your role" htmlFor="myRole" hint="What you'll own on this team, e.g. Project Lead or Documentation.">
            <input id="myRole" name="myRole" defaultValue={me?.team_role ?? ""} maxLength={50} className="field-input" />
          </Field>
          {teammates.length > 0 && (
            <div>
              <p className="text-small">Teammates&apos; roles</p>
              <ul className="card mt-1 divide-y divide-line overflow-hidden">
                {teammates.map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-small">
                    <span className="min-w-0 truncate">
                      {m.first_name} {m.last_name}
                      {m.team_role && <span className="text-hint"> · {m.team_role}</span>}
                    </span>
                    {m.role_confirmed && m.team_role ? <Chip tone="confirmed">Set</Chip> : <Chip tone="pending">Not yet</Chip>}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
          <ul className="card divide-y divide-line overflow-hidden">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-2 px-4 py-3">
                <span>
                  {m.first_name} {m.last_name} <span className="text-small text-hint">· {m.team_role ?? "no role yet"}</span>
                </span>
                {m.role_confirmed && m.team_role ? <Chip tone="confirmed">Set</Chip> : <Chip tone="pending">Not yet</Chip>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Page>
  );
}
