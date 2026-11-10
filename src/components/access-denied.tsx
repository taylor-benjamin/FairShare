import Link from "next/link";
import { notFound } from "next/navigation";
import { PermissionError } from "@/lib/permissions";
import { NotFoundError } from "@/lib/services/common";
import { Notice, Page } from "./ui";

/** Renders a friendly message for permission errors; 404s for missing records; rethrows anything else. */
export function handlePageError(e: unknown) {
  if (e instanceof NotFoundError) notFound();
  if (e instanceof PermissionError) {
    return (
      <Page narrow>
        <Notice tone="error">You don&apos;t have access to this page. If you think you should, ask your instructor.</Notice>
        <p className="mt-4">
          <Link href="/" className="link">
            Go to my home page
          </Link>
        </p>
      </Page>
    );
  }
  throw e;
}
