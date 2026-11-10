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

export function sessionSecret(): string {
  const s = config().SESSION_SECRET;
  if (s.length < 32) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 characters. Set it in .dev.vars (local) or with `wrangler secret put SESSION_SECRET`.");
  }
  return s;
}
