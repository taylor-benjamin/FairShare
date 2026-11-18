import { HeaderBar, Page } from "@/components/ui";
import { Stepper } from "@/components/stepper";
import { requireUser } from "@/lib/auth/session";
import { listMyCourses, listTemplates } from "@/lib/services/class-setup";
import { NewProjectForm } from "./new-project-form";

export const metadata = { title: "New project" };

export default async function NewProjectPage() {
  const user = await requireUser(["instructor"]);
  const [templates, courses] = await Promise.all([listTemplates(user), listMyCourses(user)]);
  return (
    <>
      <HeaderBar narrow title="Set up a class project" subtitle="About ten minutes. You can change anything later." crumbs={[{ href: "/instructor", label: "Dashboard" }]} />
      <Page narrow>
        <Stepper current={1} />
        <NewProjectForm templates={templates} courses={courses} />
      </Page>
    </>
  );
}
