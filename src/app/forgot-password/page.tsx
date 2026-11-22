import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { isDemoMode } from "@/lib/env";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  if (isDemoMode()) redirect("/login");
  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a link to choose a new one.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
