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
