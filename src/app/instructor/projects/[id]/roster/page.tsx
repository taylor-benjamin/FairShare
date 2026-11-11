import { handlePageError } from "@/components/access-denied";
import { Stepper } from "@/components/stepper";
import { HeaderBar, Notice, Page } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getSetupOverview } from "@/lib/services/class-setup";
import { importRosterAction } from "@/app/actions/instructor";
import { RosterForm } from "./roster-form";

export const metadata = { title: "Upload class list" };

const COLUMNS = ["first_name", "last_name", "email", "team_name"];
const EXAMPLE = ["Marcus", "Reed", "marcus.reed@school.edu", "Team Tigers"];

export default async function RosterPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["instructor"]);
  const projectId = Number((await params).id);
  let data;
  try {
    data = await getSetupOverview(user, projectId);
  } catch (e) {
    return handlePageError(e);
  }
  const drafts = data.teams.filter((t) => t.channel_status === "draft").length;
  const projectHref = `/instructor/projects/${projectId}`;

  return (
    <>
      <HeaderBar
        narrow
        title="Upload your class list"
        subtitle={`${data.project.project_name} · ${data.project.course_code} Section ${data.project.section_number}`}
        back={{ href: projectHref, label: "Project" }}
      />
      <Page narrow>
        <Stepper current={2} />

        <p className="text-body">FairShare creates one private channel for every team on your list. Students aren&apos;t emailed until you publish.</p>

        <section aria-labelledby="format-heading" className="card mt-5 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line bg-wash px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="format-heading" className="text-small font-semibold text-ink">
                Your file needs these four columns
              </h2>
              <p className="text-small text-hint">One row per student. Column order doesn&apos;t matter.</p>
            </div>
            <a
              href="/sample-roster.csv"
              download
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-primary bg-surface px-3 py-1.5 text-small font-semibold text-primary hover:bg-primary-soft"
            >
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M12 4v12m0 0-4-4m4 4 4-4M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download a sample
            </a>
          </div>
          {/* Scrolls sideways on narrow phones instead of squashing the example. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-left text-small">
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c} scope="col" className="px-4 pt-3 pb-1 font-mono font-semibold text-ink">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="text-hint">
                  {EXAMPLE.map((v) => (
                    <td key={v} className="px-4 pt-1 pb-3">
                      {v}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-4 py-2.5 text-small text-hint">
            From Moodle: <span className="text-ink">Participants → Download → CSV</span>, then add a <span className="font-mono text-ink">team_name</span> column.
          </p>
        </section>

        {drafts > 0 && (
          <div className="mt-5">
            <Notice tone="warning">You already uploaded a list ({drafts} draft teams). Uploading again replaces those unpublished teams.</Notice>
          </div>
        )}

        <div className="mt-6">
          <RosterForm action={importRosterAction.bind(null, projectId)} backHref={projectHref} />
        </div>
      </Page>
    </>
  );
}
