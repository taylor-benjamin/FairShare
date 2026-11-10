import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { EmptyState, HeaderBar, Page } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { publicChannels } from "@/lib/services/team-health";

export const metadata = { title: "Public channels" };

export default async function PublicChannelsPage() {
  const user = await requireUser();
  const channels = await publicChannels(user);
  return (
    <>
      <AppNav user={user} />
      <HeaderBar title="Public channels" subtitle="Finished team channels shared read-only. Evaluations are never shown." />
      <Page narrow>
        {channels.length === 0 ? (
          <EmptyState title="Nothing shared yet">When a team makes its finished channel public, it will appear here.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {channels.map((t) => (
              <li key={t.team_id}>
                <Link href={`/teams/${t.team_id}`} className="card block p-4 hover:border-primary">
                  <p className="font-semibold">{t.team_name}</p>
                  <p className="text-small text-hint">
                    {t.project_name} · {t.course_code} {t.course_name}, Section {t.section_number}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Page>
    </>
  );
}
