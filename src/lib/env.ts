import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Reads configuration (not bindings) from the Worker env, falling back to process.env. */
export function config() {
  let e: Partial<CloudflareEnv> = {};
  try {
    e = getCloudflareContext().env;
  } catch {
    // Outside a request (e.g. build time) — fall back to process.env below.
  }
  const secret = e.SESSION_SECRET || process.env.SESSION_SECRET || "";
  return {
    SESSION_SECRET: secret,
    RESEND_API_KEY: e.RESEND_API_KEY || process.env.RESEND_API_KEY || "",
    APP_URL: (e.APP_URL || process.env.APP_URL || "").replace(/\/+$/, ""),
    EMAIL_FROM: e.EMAIL_FROM || process.env.EMAIL_FROM || "FairShare <onboarding@resend.dev>",
  };
}

/** True only on the public demo site. Never set this on the real site. */
export function isDemoMode(): boolean {
  let value: string | undefined;
  try {
    value = (getCloudflareContext().env as { DEMO_MODE?: string }).DEMO_MODE;
  } catch {
    // Outside a request: fall back to process.env below.
  }
  return (value || process.env.DEMO_MODE) === "1";
}

/** The real class list for the demo site, kept in a secret so it never enters Git. */
export function demoRosterJson(): string | undefined {
  let value: string | undefined;
  try {
    value = (getCloudflareContext().env as { DEMO_ROSTER?: string }).DEMO_ROSTER;
  } catch {
    // Outside a request: fall back to process.env below.
  }
  return value || process.env.DEMO_ROSTER || undefined;
}

export function sessionSecret(): string {
  const s = config().SESSION_SECRET;
  if (s.length < 32) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 characters. Set it in .dev.vars (local) or with `wrangler secret put SESSION_SECRET`.");
  }
  return s;
}
