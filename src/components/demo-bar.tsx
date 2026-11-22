import { resetDemoAction, switchDemoUserAction } from "@/app/actions/demo";
import { demoPeople } from "@/lib/services/demo";
import type { SessionUser } from "@/lib/types";

/** Demo mode only: view the app as anyone in this visitor's private class, or start over. */
export async function DemoBar({ user }: { user: SessionUser }) {
  const people = await demoPeople(user);
  const professor = people.filter((p) => p.system_role === "instructor");
  const teams = [...new Set(people.flatMap((p) => (p.team_name ? [p.team_name] : [])))].sort();
  const label = (p: (typeof people)[number]) => `${p.first_name} ${p.last_name}${p.team_role ? ` (${p.team_role})` : ""}`;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line/70 bg-primary-tint px-4 py-2 text-small sm:px-6 lg:px-8">
      <span className="font-semibold text-primary-dark">Demo</span>
      <form action={switchDemoUserAction} className="order-last flex w-full min-w-0 items-center gap-2 sm:order-none sm:w-auto">
        <label htmlFor="demo-user" className="shrink-0 text-ink">
          View as
        </label>
        <select id="demo-user" name="userId" defaultValue={user.userId} className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-ink sm:w-64 sm:flex-none">
          <optgroup label="Professor">
            {professor.map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
          </optgroup>
          {teams.map((team) => (
            <optgroup key={team} label={team}>
              {people
                .filter((p) => p.team_name === team)
                .map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {label(p)}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <button className="shrink-0 rounded-lg bg-primary px-3 py-1.5 font-semibold text-white transition hover:opacity-90">Switch</button>
      </form>
      <form action={resetDemoAction} className="ml-auto">
        <button className="link">Reset demo</button>
      </form>
    </div>
  );
}
