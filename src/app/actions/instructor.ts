"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  addMilestone,
  completeMilestone,
  createProject,
  finishTeam,
  importRoster,
  publishTeams,
  saveSettings,
} from "@/lib/services/class-setup";
import { resolveDispute } from "@/lib/services/contribution-service";
import { reviewFlag } from "@/lib/services/peer-evaluation";
import { makeChannelPublic, reassignTask } from "@/lib/services/team-health";
import { UserError } from "@/lib/services/common";
import type { ActionState } from "@/lib/action-state";
import { appUrl, attempt, int, str, toActionError } from "./helpers";

// ── Epic 1: set up class teams ───────────────────────────────────────────────

export async function createProjectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const values = {
    templateId: str(fd, "templateId"),
    courseId: str(fd, "courseId"),
    courseCode: str(fd, "courseCode", 20),
    courseName: str(fd, "courseName", 100),
    sectionNumber: str(fd, "sectionNumber", 10),
    projectName: str(fd, "projectName", 100),
    startDate: str(fd, "startDate", 10),
    endDate: str(fd, "endDate", 10),
  };
  let projectId: number;
  try {
    projectId = await createProject(await getCurrentUser(), {
      ...values,
      templateId: Number(values.templateId),
      courseId: values.courseId && values.courseId !== "new" ? Number(values.courseId) : null,
    });
  } catch (e) {
    return { ...toActionError(e), values };
  }
  redirect(`/instructor/projects/${projectId}/roster`);
}

export async function importRosterAction(projectId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  const file = fd.get("roster");
  let text = str(fd, "pasted", 500_000);
  if (file instanceof File && file.size > 0) {
    if (file.size > 500_000) return { error: "That file is too large. A class list should be well under 500 KB." };
    text = await file.text();
  }
  if (!text) return { error: "Choose your class list file (.csv) or paste it into the box." };
  let result;
  try {
    result = await importRoster(await getCurrentUser(), projectId, text);
  } catch (e) {
    return toActionError(e);
  }
  if (result.errors.length > 0) return { error: "We couldn't use this file yet:", fieldErrors: Object.fromEntries(result.errors.map((e, i) => [String(i), e])) };
  redirect(`/instructor/projects/${projectId}/settings?imported=${result.teamCount}-${result.studentCount}`);
}

export async function saveSettingsAction(projectId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await saveSettings(await getCurrentUser(), projectId, {
      anonymous: str(fd, "anonymous") !== "no",
      memberAccess: str(fd, "memberAccess") === "read" ? "read" : "write",
    });
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/instructor/projects/${projectId}?step=publish`);
}

export async function publishAction(projectId: number, _: ActionState): Promise<ActionState> {
  return attempt(async () => {
    const r = await publishTeams(await getCurrentUser(), projectId, await appUrl());
    revalidatePath(`/instructor/projects/${projectId}`);
    const how = r.delivered === r.emailed ? "emailed" : r.delivered === 0 ? "prepared (no email key is set, so the links were printed in the server terminal)" : `prepared (${r.delivered} delivered)`;
    return `Published ${r.published} team channel${r.published === 1 ? "" : "s"}. ${r.emailed} sign-up invite${r.emailed === 1 ? "" : "s"} ${how}.`;
  });
}

export async function addMilestoneAction(projectId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await addMilestone(await getCurrentUser(), projectId, str(fd, "name", 100), str(fd, "dueDate", 10));
    revalidatePath(`/instructor/projects/${projectId}`);
    return "Milestone added.";
  });
}

export async function completeMilestoneAction(milestoneId: number, projectId: number, _: ActionState): Promise<ActionState> {
  return attempt(async () => {
    await completeMilestone(await getCurrentUser(), milestoneId);
    revalidatePath(`/instructor/projects/${projectId}`);
    return "Milestone complete — students can now rate their teammates.";
  });
}

// ── Epic 3 and team channel management ───────────────────────────────────────

export async function finishTeamAction(teamId: number, _: ActionState): Promise<ActionState> {
  return attempt(async () => {
    await finishTeam(await getCurrentUser(), teamId);
    revalidatePath(`/instructor/teams/${teamId}`);
    return "Channel finished. Students can still read it but can't log new work.";
  });
}

export async function makePublicAction(teamId: number, _: ActionState): Promise<ActionState> {
  return attempt(async () => {
    await makeChannelPublic(await getCurrentUser(), teamId);
    revalidatePath(`/instructor/teams/${teamId}`);
    revalidatePath(`/teams/${teamId}`);
    return "This channel is now public and read-only. Evaluations stay private.";
  });
}

export async function reassignAction(teamId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const taskId = int(fd, "taskId");
    const toUserId = int(fd, "toUserId");
    if (taskId === null || toUserId === null) throw new UserError("Pick a task and the teammate taking it over.");
    await reassignTask(await getCurrentUser(), taskId, toUserId, str(fd, "reason", 255));
    revalidatePath(`/instructor/teams/${teamId}`);
    return "Reassignment recorded. Future work on this task counts for the new owner.";
  });
}

export async function resolveDisputeAction(disputeId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const resolution = str(fd, "resolution") === "upheld" ? "upheld" : "rejected";
    await resolveDispute(await getCurrentUser(), disputeId, resolution, str(fd, "note", 255));
    revalidatePath("/instructor", "layout");
    return resolution === "upheld" ? "Dispute upheld — the entry won't count." : "Dispute rejected — the entry now counts as confirmed.";
  });
}

export async function reviewFlagAction(flagId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const status = str(fd, "status") === "confirmed" ? "confirmed" : "dismissed";
    await reviewFlag(await getCurrentUser(), flagId, status);
    revalidatePath("/instructor", "layout");
    return status === "confirmed" ? "Flag confirmed." : "Flag dismissed.";
  });
}
