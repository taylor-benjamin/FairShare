import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser, homeFor } from "@/lib/auth/session";
import { SignupForm } from "../login/login-form";

export const metadata = { title: "Create an account" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  return (
    <AuthShell title="Create an instructor account" subtitle="Students join through the invite link you send them.">
      <SignupForm />
    </AuthShell>
  );
}
