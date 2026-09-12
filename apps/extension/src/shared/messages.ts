import type { JobPageSnapshot, JobPosting } from "@ghostboard/shared";

export type ExtensionMessage =
  | { type: "job-detected"; job: JobPosting; confidence: number; url: string }
  | { type: "job-cleared"; url: string }
  | { type: "page-snapshot"; snapshot: JobPageSnapshot };

export interface BridgeSettings {
  port: number;
  token: string;
}
