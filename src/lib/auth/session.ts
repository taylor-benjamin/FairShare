// Authentication layer: who is making this request? (Permission is decided separately in permissions.ts.)
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { users } from "../data/repo";
import { sessionSecret } from "../env";
import type { SessionUser, SystemRole, UserRow } from "../types";
import { signSession, verifySession } from "./crypto";

const COOKIE = "fs_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // one week

export function toSessionUser(u: UserRow): SessionUser {
  return { userId: u.user_id, firstName: u.first_name, lastName: u.last_name, email: u.email, role: u.system_role };
}

export async function startSession(userId: number): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const token = await signSession({ uid: userId, exp }, sessionSecret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: true, // browsers treat http://localhost as secure, so this works in local dev too
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The signed-in user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token, sessionSecret());
  if (!payload) return null;
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
