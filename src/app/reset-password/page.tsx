import Link from "next/link";
import { resetPasswordAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { Notice } from "@/components/ui";
import { describeResetToken } from "@/lib/services/auth-service";
import { ResetPasswordForm } from "./reset-form";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const info = await describeResetToken(token);

  if (!info.valid) {
    return (
      <AuthShell title="Link expired">
        <Notice tone="error">This reset link has expired or was already used. Reset links work once and last 1 hour.</Notice>
        <p className="mt-4 text-center">
          <Link href="/forgot-password" className="link">
            Send me a new link
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle={`For ${info.email}`}>
      <ResetPasswordForm action={resetPasswordAction.bind(null, token)} email={info.email!} />
    </AuthShell>
  );
}
