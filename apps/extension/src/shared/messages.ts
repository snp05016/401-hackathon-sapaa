import type { JobPosting } from "@ghostboard/shared";

export type ExtensionMessage =
  | { type: "job-detected"; job: JobPosting; confidence: number; url: string }
  | { type: "job-cleared"; url: string };

export interface BridgeSettings {
  port: number;
  token: string;
}
