"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { addTask, answerDeleteRequest, cancelDeleteRequest, deleteTask, logContribution, setTaskStatus, verifyContribution } from "@/lib/services/contribution-service";
import { submitRatings } from "@/lib/services/peer-evaluation";
import { agreeToCharter, reassignTask, reopenCharter, saveCharterText, saveMyRole } from "@/lib/services/team-health";
import { UserError } from "@/lib/services/common";
import { parseSharePercent } from "@/lib/rules";
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

/** Deletes a task the user added, or asks its owner to approve the delete. */
export async function deleteTaskAction(taskId: number, teamId: number, _: ActionState): Promise<ActionState> {
  return attempt(async () => {
    const result = await deleteTask(await getCurrentUser(), taskId);
    revalidatePath(`/teams/${teamId}/tasks`);
    revalidatePath(`/teams/${teamId}`);
    revalidatePath("/teams");
    return result === "deleted" ? "Task deleted." : "Request sent.";
  });
}

/** The task owner approves or declines a teammate's request to delete it. */
export async function answerDeleteRequestAction(taskId: number, teamId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const approve = str(fd, "decision") === "approve";
    await answerDeleteRequest(await getCurrentUser(), taskId, approve);
    revalidatePath(`/teams/${teamId}/tasks`);
    revalidatePath(`/teams/${teamId}`);
    revalidatePath("/teams");
    return approve ? "Task deleted." : "Request declined.";
  });
}

export async function cancelDeleteRequestAction(taskId: number, teamId: number, _: ActionState): Promise<ActionState> {
  return attempt(async () => {
    await cancelDeleteRequest(await getCurrentUser(), taskId);
    revalidatePath(`/teams/${teamId}/tasks`);
    revalidatePath("/teams");
    return "Request canceled.";
  });
}

/** P13 — any writing teammate can hand a task to someone else; the move and its reason go into the team's history. */
export async function reassignTaskAction(taskId: number, teamId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const toUserId = int(fd, "toUserId");
    if (toUserId === null) throw new UserError("Pick the teammate taking over the task.");
    await reassignTask(await getCurrentUser(), taskId, toUserId, str(fd, "reason", 255));
    revalidatePath(`/teams/${teamId}/tasks`);
    revalidatePath(`/teams/${teamId}`);
    return "Task reassigned.";
  });
}

// Charter changes also update the status chip on the team banner, so revalidate the whole team layout.
const charterChanged = (teamId: number) => revalidatePath(`/teams/${teamId}`, "layout");

export async function saveCharterAction(teamId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await saveCharterText(await getCurrentUser(), teamId, { goals: str(fd, "goals", 2000), expectations: str(fd, "expectations", 2000) });
    charterChanged(teamId);
    return "Saved.";
  });
}

export async function agreeCharterAction(teamId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await agreeToCharter(await getCurrentUser(), teamId, str(fd, "version", 40));
    charterChanged(teamId);
    return "Agreed.";
  });
}

export async function reopenCharterAction(teamId: number): Promise<ActionState> {
  return attempt(async () => {
    await reopenCharter(await getCurrentUser(), teamId);
    charterChanged(teamId);
    return "Reopened.";
  });
}

export async function saveRoleAction(teamId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await saveMyRole(await getCurrentUser(), teamId, str(fd, "myRole", 50));
    charterChanged(teamId);
    return "Role saved.";
  });
}

/** P15: split a completed milestone's work across the whole team, including yourself. */
export async function submitRatingsAction(teamId: number, milestoneId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const ratings: { evaluateeId: number; shareBp: number | null; comment: string | null }[] = [];
    for (const [k, v] of fd.entries()) {
      const m = /^share_(\d+)$/.exec(k);
      if (m) ratings.push({ evaluateeId: Number(m[1]), shareBp: typeof v === "string" ? parseSharePercent(v) : null, comment: str(fd, `comment_${m[1]}`, 1000) || null });
    }
    if (ratings.length === 0) throw new UserError("Rate everyone before submitting.");
    await submitRatings(await getCurrentUser(), teamId, milestoneId, ratings);
    revalidatePath(`/teams/${teamId}/ratings`);
    return "Ratings submitted.";
  });
}

