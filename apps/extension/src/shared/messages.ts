import type { JobPageSnapshot, JobPosting, Profile } from "@ghostboard/shared";

export type ExtensionMessage =
  | { type: "job-detected"; job: JobPosting; confidence: number; url: string }
  | { type: "job-cleared"; url: string }
  | { type: "page-snapshot"; snapshot: JobPageSnapshot }
  | { type: "trigger-autofill" }
  | { type: "request-autofill-profile" }
  | { type: "autofill-profile-response"; profile: Profile | null };

export interface BridgeSettings {
  port: number;
}
