"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { addTask, logContribution, setTaskStatus, verifyContribution } from "@/lib/services/contribution-service";
import { submitRatings } from "@/lib/services/peer-evaluation";
import { confirmMyRole, saveCharter } from "@/lib/services/team-health";
import { UserError } from "@/lib/services/common";
import type { ActionState } from "@/lib/action-state";
import type { TaskStatus } from "@/lib/types";
import { attempt, int, str, toActionError } from "./helpers";

/** P09 — log a completed task. Returns per-field errors so the form can show them in place. */
export async function logTaskAction(teamId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  const values = {
    description: str(fd, "description", 300),
    hours: str(fd, "hours", 10),
    completionDate: str(fd, "completionDate", 10),
    taskId: str(fd, "taskId", 12),
  };
  try {
    const result = await logContribution(await getCurrentUser(), teamId, {
      description: values.description,
      hours: values.hours,
      completionDate: values.completionDate,
      taskId: values.taskId ? Number(values.taskId) : null,
      finishesTask: fd.get("finishesTask") === "on",
    });
    if (result.errors) return { fieldErrors: result.errors as Record<string, string>, values };
  } catch (e) {
    return { ...toActionError(e), values };
  }
  revalidatePath(`/teams/${teamId}`);
  return { ok: "Logged.", stamp: Date.now() };
}

/** P10 — confirm or dispute (reason required) a teammate's entry. */
export async function verifyAction(contributionId: number, teamId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const decision = str(fd, "decision") === "dispute" ? "dispute" : "confirm";
    await verifyContribution(await getCurrentUser(), contributionId, decision, str(fd, "reason", 255));
    revalidatePath(`/teams/${teamId}`);
    return decision === "dispute" ? "Disputed." : "Confirmed.";
  });
}

export async function addTaskAction(teamId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await addTask(await getCurrentUser(), teamId, { title: str(fd, "title", 100), ownerId: int(fd, "ownerId"), dueDate: str(fd, "dueDate", 10) });
    revalidatePath(`/teams/${teamId}/tasks`);
    return "Task added.";
  });
}

export async function taskStatusAction(taskId: number, teamId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await setTaskStatus(await getCurrentUser(), taskId, str(fd, "status") as TaskStatus);
    revalidatePath(`/teams/${teamId}/tasks`);
  });
}

export async function saveCharterAction(teamId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const roles: Record<number, string> = {};
    for (const [k, v] of fd.entries()) {
      const m = /^role_(\d+)$/.exec(k);
      if (m) roles[Number(m[1])] = String(v);
    }
    await saveCharter(await getCurrentUser(), teamId, { goals: str(fd, "goals", 2000), expectations: str(fd, "expectations", 2000), roles });
    revalidatePath(`/teams/${teamId}/charter`);
    return "Charter saved.";
  });
}

export async function confirmRoleAction(teamId: number, _: ActionState): Promise<ActionState> {
  return attempt(async () => {
    await confirmMyRole(await getCurrentUser(), teamId);
    revalidatePath(`/teams/${teamId}/charter`);
    return "Role confirmed.";
  });
}

/** P15 — rate every teammate for a completed milestone. */
export async function submitRatingsAction(teamId: number, milestoneId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const ratings: { evaluateeId: number; score: number; comment: string | null }[] = [];
    for (const [k, v] of fd.entries()) {
      const m = /^score_(\d+)$/.exec(k);
      if (m) ratings.push({ evaluateeId: Number(m[1]), score: Number(v), comment: str(fd, `comment_${m[1]}`, 1000) || null });
    }
    if (ratings.length === 0) throw new UserError("Rate every teammate from 1 to 5 before submitting.");
    await submitRatings(await getCurrentUser(), teamId, milestoneId, ratings);
    revalidatePath(`/teams/${teamId}/ratings`);
    return "Ratings submitted.";
  });
}

