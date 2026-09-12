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
  nextAction: string | null;
  nextActionDate: string | null;
  resumeId: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
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
