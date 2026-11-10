import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { Chip, EmptyState, HeaderBar, Page } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { myTeams } from "@/lib/services/team-health";

export const metadata = { title: "My teams" };

export default async function MyTeamsPage() {
  const user = await requireUser(["student"]);
  const teams = await myTeams(user);
  return (
    <>
      <AppNav user={user} />
      <HeaderBar title={`Hi, ${user.firstName}`} subtitle="Your team channels" />
      <Page narrow>
        {teams.length === 0 ? (
          <EmptyState title="You're not on a team yet">When your instructor publishes your team, open the invite link from your email.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {teams.map((t) => (
              <li key={t.team_id}>
                <Link href={`/teams/${t.team_id}`} className="card flex items-center justify-between gap-3 p-4 hover:border-primary">
                  <div className="min-w-0">
                    <p className="font-semibold">{t.team_name}</p>
                    <p className="truncate text-small text-hint">
                      {t.project_name} · {t.course_code} Section {t.section_number}
                    </p>
                  </div>
                  {t.visibility === "public" ? <Chip tone="neutral">Public</Chip> : t.channel_status === "finished" ? <Chip tone="pending">Finished</Chip> : <Chip tone="review">Active</Chip>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Page>
    </>
  );
}
