import type { JobPageSnapshot, JobPosting, MasterResume, Profile } from "@ghostboard/shared";

export type ExtensionMessage =
  | { type: "job-detected"; job: JobPosting; confidence: number; url: string }
  | { type: "job-cleared"; url: string }
  | { type: "page-snapshot"; snapshot: JobPageSnapshot }
  | { type: "job-saved"; title: string; company: string }
  | { type: "trigger-autofill"; mode: "master" | "tailored" }
  | { type: "request-autofill-profile"; mode: "master" | "tailored" }
  | { type: "autofill-profile-response"; profile: Profile | null; resume: MasterResume | null; resumeSource?: "master" | "saved" | "cached" | "generated"; error?: string };

export interface BridgeSettings {
  port: number;
}
