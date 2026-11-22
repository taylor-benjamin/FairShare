import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { DEMO_LOGINS, DEMO_PASSWORD } from "@/config/demo-class";
import { getCurrentUser, homeFor } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in" };

const DEMO = [
  ["Instructor", "linda.harris@fairshare.demo"],
  ["Student (Team Tigers lead)", "marcus.reed@fairshare.demo"],
  ["Student (Team Tigers)", "priya.shah@fairshare.demo"],
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  if (isDemoMode()) {
    return (
      <AuthShell title="Try FairShare" subtitle="You get your own private copy of the class.">
        <LoginForm demo />
        <dl className="mt-6 space-y-2 rounded-xl bg-wash p-3.5 text-small">
          <div>
            <dt className="text-hint">Professor</dt>
            <dd><code className="select-all">{DEMO_LOGINS.instructor}</code></dd>
          </div>
          <div>
            <dt className="text-hint">Student</dt>
            <dd><code className="select-all">{DEMO_LOGINS.student}</code></dd>
          </div>
          <div>
            <dt className="text-hint">Password</dt>
            <dd><code className="select-all">{DEMO_PASSWORD}</code></dd>
          </div>
        </dl>
      </AuthShell>
    );
  }
  const showDemo = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGINS === "1";
  return (
    <AuthShell title="Log in" subtitle="Welcome back.">
      <LoginForm />
      {showDemo && (
        <details className="mt-6 rounded-xl bg-wash p-3.5 text-small" open>
          <summary className="cursor-pointer font-semibold">Demo accounts (password: FairShare2026!)</summary>
          <ul className="mt-2 space-y-1">
            {DEMO.map(([label, email]) => (
              <li key={email}>
                <span className="text-hint">{label}:</span> <code className="select-all">{email}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </AuthShell>
  );
}
