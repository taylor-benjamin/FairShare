import { handlePageError } from "@/components/access-denied";
import { Stepper } from "@/components/stepper";
import { HeaderBar, Notice, Page } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getSetupOverview } from "@/lib/services/class-setup";
import { importRosterAction } from "@/app/actions/instructor";
import { RosterForm } from "./roster-form";

export const metadata = { title: "Upload class list" };

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
  return (
    <>
      <HeaderBar title="Upload your class list" subtitle={`${data.project.project_name} · ${data.project.course_code} Section ${data.project.section_number}`} back={{ href: `/instructor/projects/${projectId}`, label: "Project" }} />
      <Page narrow>
        <Stepper current={2} />
        <p className="mb-4">
          FairShare makes one private channel for every team in your list. Your file needs four columns:{" "}
          <code className="rounded bg-wash px-1">first_name, last_name, email, team_name</code>.{" "}
          <a href="/sample-roster.csv" download className="link">
            Download a sample file
          </a>
        </p>
        {drafts > 0 && (
          <div className="mb-4">
            <Notice tone="warning">You already uploaded a list ({drafts} draft teams). Uploading again replaces the unpublished teams.</Notice>
          </div>
        )}
        <RosterForm action={importRosterAction.bind(null, projectId)} />
      </Page>
    </>
  );
}
