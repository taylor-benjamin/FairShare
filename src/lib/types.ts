// Shared domain types. Row shapes mirror the D1 tables (snake_case columns).

export type SystemRole = "instructor" | "student" | "viewer";
export type AccessLevel = "read" | "write";
export type ChannelStatus = "draft" | "published" | "finished";
export type Visibility = "private" | "public";
export type VerificationStatus = "pending" | "confirmed" | "disputed";
export type Decision = "confirm" | "dispute";
export type DisputeStatus = "open" | "upheld" | "rejected";
export type FlagType = "identical_scores" | "reciprocal_scores";
export type FlagStatus = "open" | "dismissed" | "confirmed";
export type TaskStatus = "to_do" | "in_progress" | "done";
export type MilestoneStatus = "open" | "completed";

/** The signed-in user as every layer sees it. Never contains the password hash. */
export interface SessionUser {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: SystemRole;
}

export interface UserRow {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
  system_role: SystemRole;
  created_date: string;
}

export interface CourseRow {
  course_id: number;
  instructor_id: number;
  course_code: string;
  course_name: string;
  section_number: string;
}

export interface TemplateRow {
  template_id: number;
  template_name: string;
  template_description: string;
  settings_explanation: string | null;
  default_member_access: AccessLevel;
  default_anonymous_evals: number;
}

export interface ProjectRow {
  project_id: number;
  course_id: number;
  template_id: number;
  project_name: string;
  start_date: string;
  end_date: string;
  anonymous_evals: number | null;
  member_access: AccessLevel | null; // migration 0002; NULL = template default
}

export interface MilestoneRow {
  milestone_id: number;
  project_id: number;
  milestone_name: string;
  due_date: string;
  milestone_status: MilestoneStatus;
  completion_date: string | null;
}

export interface TeamRow {
  team_id: number;
  project_id: number;
  team_name: string;
  channel_status: ChannelStatus;
  visibility: Visibility;
  creation_date: string;
}

export interface MembershipRow {
  membership_id: number;
  team_id: number;
  user_id: number;
  access_level: AccessLevel;
  team_role: string | null;
  role_confirmed: number;
  joined_date: string;
}

export interface InvitationRow {
  invitation_id: number;
  team_id: number;
  invited_email: string;
  invite_token: string;
  invite_status: "pending" | "accepted" | "expired";
  date_received: string;
  accepted_date: string | null;
}

export interface CharterRow {
  charter_id: number;
  team_id: number;
  team_goals: string;
  expectations: string;
  created_date: string;
  completed_date: string | null;
}

export interface TaskRow {
  task_id: number;
  team_id: number;
  user_id: number | null;
  task_title: string;
  due_date: string | null;
  task_status: TaskStatus;
}

export interface ContributionRow {
  contribution_id: number;
  team_id: number;
  user_id: number;
  task_id: number | null;
  description: string;
  hours_spent: number | null;
  completion_date: string;
  verification_status: VerificationStatus;
  logged_date: string;
}

export interface VerificationRow {
  verification_id: number;
  contribution_id: number;
  verifier_id: number;
  decision: Decision;
  reason: string | null;
  decision_date: string;
}

export interface DisputeRow {
  dispute_id: number;
  verification_id: number;
  resolved_by_id: number | null;
  dispute_status: DisputeStatus;
  resolution_note: string | null;
  opened_date: string;
  resolved_date: string | null;
}

export interface EvaluationRow {
  evaluation_id: number;
  milestone_id: number;
  team_id: number;
  evaluator_id: number;
  evaluatee_id: number;
  score: number;
  comment: string | null;
  submission_date: string;
}

export interface FlagRow {
  flag_id: number;
  milestone_id: number;
  team_id: number;
  rater_id: number;
  flag_type: FlagType;
  flag_details: string | null;
  review_status: FlagStatus;
  flagged_date: string;
}
