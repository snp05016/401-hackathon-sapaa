import type { JobPosting } from "../types/job";
import type { Application, ApplicationStage } from "../types/application";
import type { Profile } from "../types/profile";
import type { DetectedFormField } from "../types/form";

export const BRIDGE_DEFAULT_PORT = 4173;
export const BRIDGE_TOKEN_HEADER = "authorization";

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
  company: string;
  title: string;
  location: string | null;
  jobUrl: string;
  jobDescription: string;
  source: string;
  postedAt: string | null;
  salaryRange: string | null;
}

export interface CreateJobResponse {
  job: JobPosting;
  applicationId: string;
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
}

export interface PageContextResponse {
  received: true;
}
