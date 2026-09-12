export type ApplicationStage = "found" | "applied" | "interviewing" | "offer" | "rejected" | "ghosted";

export interface Application {
  id: string;
  company: string;
  title: string;
  location: string | null;
  jobUrl: string;
  jobDescription: string;
  status: ApplicationStage;
  dateFound: string;
  dateApplied: string | null;
  /** Application deadline as a local calendar date (YYYY-MM-DD), if known. */
  deadline?: string | null;
  lastActivityAt: string;
  /** True when the application is due for a follow-up based on status and elapsed time. */
  followUpOn: boolean;
  nextAction: string | null;
  nextActionDate: string | null;
  resumeId: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export type FollowUpKind = "application" | "interview" | "thank_you";

/** A templated message offered when an application is due for a follow-up. */
export interface FollowUpMessage {
  id: string;
  title: string;
  description: string;
  body: string;
}

/** A follow-up recommendation tied to a specific application. */
export interface FollowUpSuggestion {
  applicationId: string;
  company: string;
  title: string;
  kind: FollowUpKind;
  message: FollowUpMessage;
}

export type ApplicationEventType = "created" | "stage_changed" | "email_received" | "note_added" | "reminder_set" | "resume_attached";

export interface ApplicationEvent {
  id: string;
  applicationId: string;
  type: ApplicationEventType;
  title: string;
  description: string | null;
  occurredAt: string;
  metadata: Record<string, unknown> | null;
}
