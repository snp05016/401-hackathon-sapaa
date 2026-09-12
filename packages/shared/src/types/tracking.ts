import type { Application } from "./application";

export interface StalenessResult {
  applicationId: string;
  isStale: boolean;
  daysSinceLastActivity: number;
  suggestedAction: string | null;
}

export interface ApplicationStatusUpdate {
  applicationId: string;
  newStatus: Application["status"] | null;
  confidence: number;
  evidence: string | null;
}

export interface ApplicationStatusProvider {
  name: string;
  checkForUpdates(applications: Application[]): Promise<ApplicationStatusUpdate[]>;
}

export interface GmailCandidate {
  applicationId: string;
  company: string;
  title: string;
  status: Application["status"];
  updatedAt: string;
}

export interface GmailSuggestion {
  id: string;
  messageId: string;
  threadId: string;
  receivedAt: string;
  subject: string;
  sender: string;
  newStatus: "interviewing" | "rejected";
  confidence: number;
  evidence: string;
  candidates: GmailCandidate[];
}

export interface GmailState {
  configured: boolean;
  connected: boolean;
  account: string | null;
  automaticChecks: boolean;
  lastCheckedAt: string | null;
  hasMore: boolean;
  busy: boolean;
  error: string | null;
  suggestions: GmailSuggestion[];
}
