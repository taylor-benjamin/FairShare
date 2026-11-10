import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Notice } from "@/components/ui";
import { describeInvite } from "@/lib/services/auth-service";
import { AcceptInviteForm } from "./accept-form";

export const metadata = { title: "Join your team" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await describeInvite(token);

  if (info.status !== "pending") {
    const msg = {
      accepted: "This invite link has already been used. Log in with the account you created.",
      expired: "This invite link has expired. Ask your instructor to send a new one.",
      not_found: "This invite link isn't valid. Check that you copied the whole link from the email.",
      not_ready: "Your instructor hasn't opened this team yet. Try the link again later.",
    }[info.status];
    return (
      <AuthShell title="Join your team">
        <Notice tone={info.status === "accepted" ? "info" : "error"}>{msg}</Notice>
        <p className="mt-4 text-center">
          <Link href="/login" className="link">
            Go to log in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={`Join ${info.teamName}`} subtitle={info.courseLabel}>
      <p className="mb-4 text-small text-hint">
        You&apos;ll log the work you finish, confirm your teammates&apos; work, and rate each other at milestones. Ratings are private.
      </p>
      <AcceptInviteForm token={token} email={info.email!} hasAccount={!!info.hasAccount} />
    </AuthShell>
  );
}
