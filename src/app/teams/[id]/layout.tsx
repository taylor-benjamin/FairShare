import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { handlePageError } from "@/components/access-denied";
import { HeaderBar, Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { teamHeader } from "@/lib/services/team-health";
import { TeamTabs } from "./team-tabs";

export default async function TeamLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const teamId = Number((await params).id);
  let header;
  try {
    header = await teamHeader(user, teamId);
  } catch (e) {
    return (
      <>
        <AppNav user={user} />
        {handlePageError(e)}
      </>
    );
  }
  const { team, tabs, readOnlyReason } = header;
  const back = tabs.instructor
    ? { href: `/instructor/teams/${teamId}`, label: "Instructor view" }
    : { href: "/teams", label: "My teams" };

  const items = [
    { href: `/teams/${teamId}`, label: "Log & Verify", show: true },
    { href: `/teams/${teamId}/tasks`, label: "Tasks", show: tabs.tasks },
    { href: `/teams/${teamId}/charter`, label: "Charter", show: tabs.charter },
    { href: `/teams/${teamId}/ratings`, label: "Ratings", show: tabs.ratings },
    { href: `/teams/${teamId}/feedback`, label: "My feedback", show: tabs.feedback },
  ].filter((i) => i.show);

  return (
    <>
      <AppNav user={user} />
      <HeaderBar title={team.team_name} subtitle={`${team.project_name} · ${team.course_code} Section ${team.section_number}`} back={back} />
      {items.length > 1 && <TeamTabs items={items} />}
      {readOnlyReason && (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <Notice tone="info">{readOnlyReason}</Notice>
        </div>
      )}
      {children}
    </>
  );
}
