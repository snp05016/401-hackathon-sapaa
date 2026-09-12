import type { Application, StalenessResult } from "@ghostboard/shared";

/**
 * TODO(team)[tracking]: implement stage-aware thresholds (e.g. 14d after
 * applied, 7d after interview) and generate a suggestedAction.
 */
export function evaluateApplicationStaleness(application: Application, now: Date = new Date()): StalenessResult {
  const daysSinceLastActivity = Math.floor((now.getTime() - new Date(application.lastActivityAt).getTime()) / 86_400_000);
  return { applicationId: application.id, isStale: false, daysSinceLastActivity, suggestedAction: null };
}
