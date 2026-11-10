import "server-only";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { config } from "@/lib/env";
import { PermissionError } from "@/lib/permissions";
import { NotFoundError, UserError } from "@/lib/services/common";
import type { ActionState } from "@/lib/action-state";

/** Turns service errors into a message for the form. Redirects and unexpected errors pass through. */
export function toActionError(e: unknown): ActionState {
  unstable_rethrow(e);
  if (e instanceof UserError || e instanceof PermissionError || e instanceof NotFoundError) {
    return { error: e.message };
  }
  console.error(e);
  return { error: "Something went wrong on our side. Please try again." };
}

export async function attempt(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const ok = await fn();
    return { ok: ok || undefined, stamp: Date.now() };
  } catch (e) {
    return toActionError(e);
  }
}

/** Base URL for links in emails: APP_URL if set, otherwise this request's own origin. */
export async function appUrl(): Promise<string> {
  const configured = config().APP_URL;
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export function str(fd: FormData, key: string, max = 1000): string {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

export function int(fd: FormData, key: string): number | null {
  const raw = String(fd.get(key) ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}
