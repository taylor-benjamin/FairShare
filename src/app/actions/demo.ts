"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth/session";
import { resetDemo, switchDemoUser } from "@/lib/services/demo";
import { int } from "./helpers";

export async function switchDemoUserAction(fd: FormData): Promise<void> {
  let home = "/";
  try {
    home = homeFor((await switchDemoUser(await getCurrentUser(), int(fd, "userId") ?? NaN)).role);
  } catch (e) {
    // A tab left open across a reset can name someone from the old copy. Just go back to the dashboard.
    unstable_rethrow(e);
    console.error(e);
  }
  redirect(home);
}

export async function resetDemoAction(): Promise<void> {
  let home = "/";
  try {
    home = homeFor((await resetDemo(await getCurrentUser())).role);
  } catch (e) {
    unstable_rethrow(e);
    console.error(e);
  }
  redirect(home);
}
