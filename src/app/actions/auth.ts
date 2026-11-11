"use server";

import { redirect } from "next/navigation";
import { homeFor } from "@/lib/auth/session";
import { acceptInvite, logIn, logOut, requestPasswordReset, resetPassword, signUp } from "@/lib/services/auth-service";
import type { ActionState } from "@/lib/action-state";
import { appUrl, attempt, str, toActionError } from "./helpers";

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email", 100);
  let home: string;
  try {
    const user = await logIn(email, String(fd.get("password") ?? ""));
    home = homeFor(user.role);
  } catch (e) {
    return { ...toActionError(e), values: { email } };
  }
  redirect(home);
}

export async function signupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const values = { firstName: str(fd, "firstName", 50), lastName: str(fd, "lastName", 50), email: str(fd, "email", 100), role: str(fd, "role", 20) };
  let home: string;
  try {
    const user = await signUp({ ...values, password: String(fd.get("password") ?? ""), role: values.role as "instructor" | "viewer", appUrl: await appUrl() });
    home = homeFor(user.role);
  } catch (e) {
    return { ...toActionError(e), values };
  }
  redirect(home);
}

export async function logoutAction(): Promise<void> {
  await logOut();
  redirect("/login");
}

export async function acceptInviteAction(token: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const values = { firstName: str(fd, "firstName", 50), lastName: str(fd, "lastName", 50) };
  let teamId: number;
  try {
    teamId = await acceptInvite(token, { ...values, password: String(fd.get("password") ?? "") });
  } catch (e) {
    return { ...toActionError(e), values };
  }
  redirect(`/teams/${teamId}/charter?welcome=1`);
}

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email", 100);
  const result = await attempt(async () => {
    await requestPasswordReset(email, await appUrl());
    return "If that email has a FairShare account, a reset link is on its way. It expires in 1 hour — check your spam folder too.";
  });
  return { ...result, values: { email } };
}

export async function resetPasswordAction(token: string, _: ActionState, fd: FormData): Promise<ActionState> {
  let home: string;
  try {
    const user = await resetPassword(token, String(fd.get("password") ?? ""), String(fd.get("confirm") ?? ""));
    home = homeFor(user.role);
  } catch (e) {
    return toActionError(e);
  }
  redirect(home);
}
