import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser, homeFor } from "@/lib/auth/session";
import { SignupForm } from "../login/login-form";

export const metadata = { title: "Create an account" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  return (
    <AuthShell title="Create an account" subtitle="We'll email you a welcome note with a link back here.">
      <SignupForm />
    </AuthShell>
  );
}
