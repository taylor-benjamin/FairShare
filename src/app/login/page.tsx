import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser, homeFor } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in" };

const DEMO = [
  ["Instructor", "linda.harris@fairshare.demo"],
  ["Student (Team Tigers lead)", "marcus.reed@fairshare.demo"],
  ["Student (Team Tigers)", "priya.shah@fairshare.demo"],
  ["Viewer (read-only)", "viewer@fairshare.demo"],
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const showDemo = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGINS === "1";
  return (
    <AuthShell title="Log in" subtitle="Welcome back.">
      <LoginForm />
      {showDemo && (
        <details className="mt-6 rounded-lg bg-wash p-3 text-small" open>
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
