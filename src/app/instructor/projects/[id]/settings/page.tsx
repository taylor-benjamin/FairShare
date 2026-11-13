import { saveSettingsAction } from "@/app/actions/instructor";
import { handlePageError } from "@/components/access-denied";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Stepper } from "@/components/stepper";
import { HeaderBar, Notice, Page } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getSetupOverview } from "@/lib/services/class-setup";

export const metadata = { title: "Review settings" };

function Option({ name, value, checked, title, children }: { name: string; value: string; checked: boolean; title: string; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 has-checked:border-primary has-checked:bg-primary-soft">
      <input type="radio" name={name} value={value} defaultChecked={checked} className="mt-1 accent-primary" />
      <span>
        <span className="font-semibold">{title}</span>
        <span className="block text-small text-hint">{children}</span>
      </span>
    </label>
  );
}

/** P07 — every default explained in plain language; accept or adjust. */
export default async function SettingsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ imported?: string }> }) {
  const user = await requireUser(["instructor"]);
  const projectId = Number((await params).id);
  const { imported } = await searchParams;
  let data;
  try {
    data = await getSetupOverview(user, projectId);
  } catch (e) {
    return handlePageError(e);
  }
  const { project, settings } = data;
  const [teamCount, studentCount] = (imported ?? "").split("-");

  return (
    <>
      <HeaderBar narrow title="Review the settings" subtitle={`${project.project_name} · ${project.course_code} Section ${project.section_number}`} back={{ href: `/instructor/projects/${projectId}`, label: "Project" }} />
      <Page narrow>
        <Stepper current={3} />
        {imported && (
          <div className="mb-5">
            <Notice tone="success">
              Your list looks good: {studentCount} students in {teamCount} teams. Saved as drafts. No one is emailed until you publish.
            </Notice>
          </div>
        )}

        <div className="card mb-6 bg-wash p-4">
          <p className="section-label">The “{project.template_name}” defaults, in plain language</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {settings.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="mt-2 text-small text-hint">Most instructors keep these. Change anything below if you need to.</p>
        </div>

        <ActionForm action={saveSettingsAction.bind(null, projectId)} className="space-y-6">

          <fieldset className="space-y-2">
            <legend className="font-semibold">Should peer ratings be anonymous?</legend>
            <Option name="anonymous" value="yes" checked={settings.anonymous} title="Yes, keep raters anonymous (recommended)">
              Students see the ratings they received but never who gave them. People are more honest this way.
            </Option>
            <Option name="anonymous" value="no" checked={!settings.anonymous} title="No, show names">
              Students see which teammate gave each rating they received.
            </Option>
          </fieldset>

          <p className="text-small text-hint">Either way, only you can see every rating and the comments students write.</p>

          <SubmitButton full pendingText="Saving…">
            Next
          </SubmitButton>
        </ActionForm>
      </Page>
    </>
  );
}
