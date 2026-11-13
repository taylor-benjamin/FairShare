// Authentication layer: who is making this request? (Permission is decided separately in permissions.ts.)
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessions, users } from "../data/repo";
import { sessionSecret } from "../env";
import type { SessionUser, SystemRole, UserRow } from "../types";
import { randomToken, signSession, verifySession } from "./crypto";

const COOKIE = "fs_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // one week

export function toSessionUser(u: UserRow): SessionUser {
  return { userId: u.user_id, firstName: u.first_name, lastName: u.last_name, email: u.email, role: u.system_role };
}

/** Creates a server-side session row and sets the signed cookie that points to it. */
export async function startSession(userId: number): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const sid = randomToken();
  await sessions.removeExpiredForUser(userId);
  await sessions.create(sid, userId, new Date(exp * 1000).toISOString());
  const token = await signSession({ uid: userId, sid, exp }, sessionSecret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: true, // browsers treat http://localhost as secure, so this works in local dev too
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Logs out this browser: deletes the session row (so a copied cookie stops working) and the cookie. */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const payload = token ? await verifySession(token, sessionSecret()) : null;
  if (payload?.sid) await sessions.remove(payload.sid);
  jar.delete(COOKIE);
}

/** Logs a user out everywhere (used after a password reset). */
export async function endAllSessions(userId: number): Promise<void> {
  await sessions.removeAllForUser(userId);
}

/** The signed-in user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token, sessionSecret());
  // Cookies from before server-side sessions (no sid) are no longer accepted.
  if (!payload?.sid || !(await sessions.isValid(payload.sid, payload.uid))) return null;
  const row = await users.byId(payload.uid);
  // Only instructor and student accounts can sign in (the old "viewer" role was removed).
  return row && (row.system_role === "instructor" || row.system_role === "student") ? toSessionUser(row) : null;
});

/** For pages: sends signed-out visitors to the login page and wrong roles to their home page. */
export async function requireUser(roles?: SystemRole[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export function homeFor(role: SystemRole): string {
  return role === "instructor" ? "/instructor" : "/teams";
}
