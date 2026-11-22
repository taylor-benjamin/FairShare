// Demo mode (DEMO_MODE=1): each visitor who signs in gets a private copy of the class.
// Copies are ordinary instructor and student accounts, so the normal permission checks keep them apart.
import "server-only";
import { startSession, toSessionUser } from "../auth/session";
import { DEMO_LIMITS, DEMO_PASSWORD } from "../../config/demo-class";
import { demoWorkspaces, users } from "../data/repo";
import { buildDemoClass, demoHomeEmail, demoLoginRole, parseDemoRoster, workspaceOf } from "../demo";
import { demoRosterJson, isDemoMode } from "../env";
import type { SessionUser } from "../types";
import { NotFoundError, UserError } from "./common";

function requireDemo() {
  if (!isDemoMode()) throw new NotFoundError();
}

function requireWorkspace(user: SessionUser | null): string {
  requireDemo();
  const workspace = user ? workspaceOf(user.email) : null;
  if (!workspace) throw new UserError("Log in with a demo account first.");
  return workspace;
}

async function createWorkspace(): Promise<string> {
  // Cleanup is best effort: a failure here shouldn't stop someone from signing in.
  try {
    await demoWorkspaces.removeOlderThan(new Date(Date.now() - DEMO_LIMITS.WORKSPACE_HOURS * 60 * 60 * 1000).toISOString());
  } catch (e) {
    console.error("Demo cleanup failed", e);
  }
  if ((await demoWorkspaces.count()) >= DEMO_LIMITS.MAX_WORKSPACES) {
    throw new UserError("The demo is full right now. Try again later.");
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const workspace = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const base = (1 + Math.floor(Math.random() * 1_000_000)) * 1000;
    try {
      await demoWorkspaces.insert(buildDemoClass(workspace, base, Date.now(), parseDemoRoster(demoRosterJson())));
      return workspace;
    } catch (e) {
      lastError = e; // Most likely an ID range already in use, so try another.
    }
  }
  throw lastError;
}

async function signInto(workspace: string, role: "instructor" | "student"): Promise<SessionUser> {
  const row = await users.byEmail(demoHomeEmail(role, workspace, parseDemoRoster(demoRosterJson())));
  if (!row) throw new NotFoundError();
  await startSession(row.user_id);
  return toSessionUser(row);
}

/** The shared logins: checks the public password, then opens a fresh private class. */
export async function logInToDemo(email: string, password: string): Promise<SessionUser> {
  requireDemo();
  const role = demoLoginRole(email);
  if (!role || password !== DEMO_PASSWORD) throw new UserError("That email and password don't match an account.");
  return signInto(await createWorkspace(), role);
}

/** Everyone in this visitor's copy, for the demo bar. */
export async function demoPeople(user: SessionUser | null) {
  return demoWorkspaces.people(requireWorkspace(user));
}

/** Becomes another person in the same copy. Accounts in other copies are refused. */
export async function switchDemoUser(user: SessionUser | null, targetId: number): Promise<SessionUser> {
  const workspace = requireWorkspace(user);
  const target = Number.isInteger(targetId) ? await users.byId(targetId) : null;
  if (!target || workspaceOf(target.email) !== workspace) throw new NotFoundError("That person isn't in this demo.");
  await startSession(target.user_id);
  return toSessionUser(target);
}

/** Replaces this visitor's copy with a fresh one and keeps them in the same role. */
export async function resetDemo(user: SessionUser | null): Promise<SessionUser> {
  const old = requireWorkspace(user);
  const fresh = await signInto(await createWorkspace(), user!.role === "instructor" ? "instructor" : "student");
  await demoWorkspaces.remove(old);
  return fresh;
}
