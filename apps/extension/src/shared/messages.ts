import type { JobPageSnapshot, JobPosting, MasterResume, Profile } from "@ghostboard/shared";

export type ExtensionMessage =
  | { type: "job-detected"; job: JobPosting; confidence: number; url: string }
  | { type: "job-cleared"; url: string }
  | { type: "page-snapshot"; snapshot: JobPageSnapshot }
  | { type: "job-saved"; title: string; company: string }
  | { type: "trigger-autofill" }
  | { type: "request-autofill-profile" }
  | { type: "autofill-profile-response"; profile: Profile | null; resume: MasterResume | null };

export interface BridgeSettings {
  port: number;
}
