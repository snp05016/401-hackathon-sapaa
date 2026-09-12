import type {
  Application,
  FollowUpKind,
  FollowUpMessage,
  FollowUpSuggestion,
} from "@ghostboard/shared";

const TWO_WEEKS_MS = 14 * 86_400_000;
const SEVENTY_TWO_HOURS_MS = 72 * 3_600_000;
const ONE_WEEK_MS = 7 * 86_400_000;

export const FOLLOW_UP_KIND_LABELS: Record<FollowUpKind, string> = {
  application: "Following up on application",
  interview: "Following up on interview",
  thank_you: "Thank the recruiter for the interview",
};

export const FOLLOW_UP_MESSAGES: Record<FollowUpKind, FollowUpMessage> = {
  application: {
    id: "follow-up-application",
    title: "Follow up on your application",
    description: "Two weeks have passed since you applied with no response yet.",
    body: `Hi [Recruiter Name],

I'm writing to check on the status of my application for the [Job Title] role at [Company]. I remain very interested in the opportunity and would appreciate any update you can share.

Thank you for your time.`,
  },
  interview: {
    id: "follow-up-interview",
    title: "Follow up on your interview",
    description: "A week has passed since the interview and you have not heard back yet.",
    body: `Hi [Recruiter Name],

I wanted to follow up on my interview for the [Job Title] role at [Company]. I really enjoyed our conversation and would appreciate any update on next steps.

Thank you again for the opportunity.`,
  },
  thank_you: {
    id: "thank-recruiter-interview",
    title: "Thank the recruiter for the interview",
    description: "You interviewed within the last 72 hours; send a thank-you note while it is fresh.",
    body: `Hi [Recruiter Name],

Thank you so much for taking the time to interview me for the [Job Title] role at [Company]. I enjoyed learning more about the team and the work, and I would be excited to contribute.

I look forward to hearing from you.`,
  },
};

/**
 * Classifies whether an application is due for a follow-up based on its status
 * and elapsed time from the relevant anchor date.
 */
export function evaluateFollowUpKind(application: Application, now: Date = new Date()): FollowUpKind | null {
  const nowTime = now.getTime();

  if (application.status === "applied") {
    if (!application.dateApplied) return null;
    const elapsed = nowTime - new Date(application.dateApplied).getTime();
    if (elapsed >= TWO_WEEKS_MS) return "application";
    return null;
  }

  if (application.status === "interviewing") {
    const elapsed = nowTime - new Date(application.lastActivityAt).getTime();
    if (elapsed <= SEVENTY_TWO_HOURS_MS) return "thank_you";
    if (elapsed >= ONE_WEEK_MS) return "interview";
    return null;
  }

  return null;
}

/** Anchor timestamp that defines whether a dismissal still covers the current follow-up. */
function dismissalAnchor(application: Application, kind: FollowUpKind): string | null {
  return kind === "application" ? application.dateApplied : application.lastActivityAt;
}

/**
 * True when the user already dismissed this follow-up and the application's
 * relevant anchor (apply date or last activity) has not changed since.
 */
export function isFollowUpDismissed(application: Application, kind: FollowUpKind): boolean {
  if (!application.followUpDismissedAt) return false;
  const anchor = dismissalAnchor(application, kind);
  return anchor !== null && application.followUpDismissedAt >= anchor;
}

export function buildFollowUpSuggestions(
  applications: Application[],
  now: Date = new Date()
): FollowUpSuggestion[] {
  return applications.flatMap((application) => {
    const kind = evaluateFollowUpKind(application, now);
    if (!kind || isFollowUpDismissed(application, kind)) return [];
    return [
      {
        applicationId: application.id,
        company: application.company,
        title: application.title,
        kind,
        message: FOLLOW_UP_MESSAGES[kind],
      },
    ];
  });
}