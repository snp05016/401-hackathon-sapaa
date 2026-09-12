import type { Application, ApplicationStage } from "@ghostboard/shared";

export type SuggestedAction =
  | "FOLLOW_UP_APPLICATION"
  | "CHECK_IN_RECRUITER"
  | "SEND_THANK_YOU_OR_CHECK_IN"
  | "REVIEW_OFFER_DEADLINE"
  | "CHECK_IN";

export interface StalenessResult {
  applicationId: string;
  isStale: boolean;
  daysSinceLastActivity: number;
  suggestedAction: SuggestedAction | null;
}

/**
 * Stage-aware staleness thresholds in days.
 */
const STAGE_STALENESS_THRESHOLDS: Record<ApplicationStage, number> = {
  found: 7,
  applied: 14,
  interviewing: 7,
  offer: 3,
  ghosted: Infinity,
  rejected: Infinity,
};

/**
 * Recommended actions mapping when an application is stale.
 */
const STAGE_SUGGESTED_ACTIONS: Partial<Record<ApplicationStage, SuggestedAction>> = {
  found: "FOLLOW_UP_APPLICATION",
  applied: "FOLLOW_UP_APPLICATION",
  interviewing: "SEND_THANK_YOU_OR_CHECK_IN",
  offer: "REVIEW_OFFER_DEADLINE",
};

/**
 * Evaluates whether an application is stale based on its current status
 * and days since last activity.
 */
export function evaluateApplicationStaleness(
  application: Application,
  now: Date = new Date()
): StalenessResult {
  const lastActivityTime = new Date(application.lastActivityAt).getTime();
  const daysSinceLastActivity = Math.floor(
    (now.getTime() - lastActivityTime) / 86_400_000
  );

  const threshold = STAGE_STALENESS_THRESHOLDS[application.status] ?? 14;
  const isStale = daysSinceLastActivity >= threshold;

  const suggestedAction = isStale
    ? STAGE_SUGGESTED_ACTIONS[application.status] ?? "CHECK_IN"
    : null;

  return {
    applicationId: application.id,
    isStale,
    daysSinceLastActivity,
    suggestedAction,
  };
}