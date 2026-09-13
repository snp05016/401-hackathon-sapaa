import type { JobPosting } from "../types/job";
import type { Application, ApplicationStage } from "../types/application";
import type { Profile } from "../types/profile";
import type { MasterResume } from "../types/resume";
import type { DetectedFormField } from "../types/form";

export const BRIDGE_DEFAULT_PORT = 4173;
export const BRIDGE_EXTENSION_MESSAGES_DEFAULT_PORT = 42786;
export const BRIDGE_EXTENSION_MESSAGES_PATH = "/extension-messages";
export const BRIDGE_TOKEN_HEADER = "authorization";

export interface ExtensionConnectRequest {
  type: "extension-connect";
}

export interface ExtensionAuthenticationMessage {
  type: "bridge-authentication";
  port: number;
  token: string;
}

export function isExtensionConnectRequest(message: unknown): message is ExtensionConnectRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "extension-connect"
  );
}

export function isExtensionAuthenticationMessage(message: unknown): message is ExtensionAuthenticationMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as { type?: unknown; port?: unknown; token?: unknown };
  return (
    candidate.type === "bridge-authentication" &&
    typeof candidate.port === "number" &&
    Number.isInteger(candidate.port) &&
    candidate.port > 0 &&
    candidate.port <= 65_535 &&
    typeof candidate.token === "string" &&
    candidate.token.length > 0
  );
}

export interface BridgeErrorResponse {
  error: string;
}

export interface HealthResponse {
  ok: true;
  version: string;
}

export interface ProfileResponse {
  profile: Profile;
}

export interface CreateJobRequest {
  id?: string;
  fingerprint?: string;
  contentFingerprint?: string | null;
  company: string;
  title: string;
  location: string | null;
  jobUrl: string;
  jobDescription: string;
  source: string;
  sourceJobId?: string | null;
  employmentType?: string | null;
  requirements?: JobPosting["requirements"];
  keywords?: JobPosting["keywords"];
  postedAt: string | null;
  salaryRange: string | null;
  scrapedAt?: string;
  workArrangement?: JobPosting["workArrangement"];
  applicationDeadline?: string | null;
  startDate?: string | null;
  termDuration?: string | null;
  responsibilities?: JobPosting["responsibilities"];
  preferredQualifications?: JobPosting["preferredQualifications"];
  education?: string | null;
  workAuthorization?: string | null;
  clearance?: string | null;
}

export interface CreateJobResponse {
  job: JobPosting;
  applicationId: string;
}

/** A serialization-safe page capture produced by the Chromium extension. */
export interface JobPageSnapshot {
  url: string;
  pageTitle?: string;
  html?: string;
  visibleText?: string;
  selectedContent?: string[];
  metadata?: Record<string, string>;
  capturedAt?: string;
}

export interface IngestJobRequest {
  url: string;
  html?: string;
  visibleText?: string;
  snapshot?: JobPageSnapshot;
}

export type JobDetectionOutcome = "job" | "not_job" | "uncertain";

export interface IngestJobResponse {
  outcome: JobDetectionOutcome;
  confidence: number;
  posting?: JobPosting;
  evidence: string[];
  warnings: string[];
  cached: boolean;
}

export interface UpsertApplicationRequest {
  id?: string;
  company: string;
  title: string;
  location?: string | null;
  jobUrl: string;
  jobDescription?: string;
  status?: ApplicationStage;
  resumeId?: string | null;
  source?: string;
}

export interface UpsertApplicationResponse {
  application: Application;
}

export interface PageContextRequest {
  url: string;
  pageType: "job_posting" | "application_form" | "unknown";
  detectedJob?: Partial<JobPosting>;
  detectedFields?: DetectedFormField[];
  snapshot?: JobPageSnapshot;
}

export interface PageContextResponse {
  received: true;
}

/**
 * Read-only data exposed to any local application holding the bridge token —
 * not extension-specific. Grouping applications by stage mirrors the desktop
 * Kanban board so external tools don't need to reimplement stage ordering.
 */
export interface KanbanColumn {
  stage: ApplicationStage;
  label: string;
  applications: Application[];
}

export interface ExternalKanbanResponse {
  columns: KanbanColumn[];
}

export interface ExternalResumeTemplateResponse {
  resume: MasterResume;
}
