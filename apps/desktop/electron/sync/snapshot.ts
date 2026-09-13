import { APPLICATION_STAGES, type Application, type ApplicationEvent } from "@ghostboard/shared";
import type {
  SyncAnalytics,
  SyncDeadline,
  SyncDuplicateGroup,
  SyncFollowUp,
  SyncRecruiterSignal,
  SyncSnapshotData,
  SyncStaleness,
  SyncTodaySummary,
} from "@ghostboard/shared";
import {
  FOLLOW_UP_KIND_LABELS,
  buildFollowUpSuggestions,
  mixedSourceGroups,
  evaluateApplicationStaleness,
  evaluateDeadline,
  summarizeToday,
} from "@ghostboard/tracking";

const DAY_MS = 86_400_000;

/** Stages that mean the employer has engaged with the application in some way. */
const RESPONDED_STAGES = new Set(["interviewing", "offer", "rejected"]);
const CLOSED_STAGES = new Set(["rejected", "ghosted"]);

function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

/**
 * Computes the canonical metrics once on the desktop so the companion app never
 * derives its own, divergent version of the same number.
 */
export function computeAnalytics(
  applications: Application[],
  events: ApplicationEvent[],
  staleness: SyncStaleness[],
  now: Date = new Date()
): SyncAnalytics {
  const nowTime = now.getTime();
  const todayStart = startOfDay(nowTime);
  const weekStart = todayStart - 6 * DAY_MS;

  const stageCounts = APPLICATION_STAGES.map((stage) => ({
    stage,
    count: applications.filter((application) => application.status === stage).length,
  }));

  const appliedApplications = applications.filter((application) => application.dateApplied !== null);
  const appliedLast7Days = Array.from({ length: 7 }, (_, index) => {
    const dayStart = weekStart + index * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    return appliedApplications.filter((application) => {
      const applied = parseTime(application.dateApplied);
      return applied !== null && applied >= dayStart && applied < dayEnd;
    }).length;
  });

  const respondedCount = applications.filter((application) => RESPONDED_STAGES.has(application.status)).length;
  const interviewCount = applications.filter(
    (application) => application.status === "interviewing" || application.status === "offer"
  ).length;
  const offerCount = applications.filter((application) => application.status === "offer").length;

  const responseDurations: number[] = [];
  const eventsByApplication = new Map<string, ApplicationEvent[]>();
  for (const event of events) {
    const bucket = eventsByApplication.get(event.applicationId);
    if (bucket) bucket.push(event);
    else eventsByApplication.set(event.applicationId, [event]);
  }
  for (const application of appliedApplications) {
    const appliedTime = parseTime(application.dateApplied);
    if (appliedTime === null) continue;
    const applicationEvents = eventsByApplication.get(application.id) ?? [];
    const firstResponse = applicationEvents
      .filter((event) => event.type === "email_received" || event.type === "stage_changed")
      .map((event) => parseTime(event.occurredAt))
      .filter((time): time is number => time !== null && time > appliedTime)
      .sort((left, right) => left - right)[0];
    if (firstResponse !== undefined) responseDurations.push((firstResponse - appliedTime) / DAY_MS);
  }

  const sourceTotals = new Map<string, number>();
  for (const application of applications) {
    sourceTotals.set(application.source, (sourceTotals.get(application.source) ?? 0) + 1);
  }

  return {
    totalApplications: applications.length,
    stageCounts,
    appliedThisWeek: appliedApplications.filter((application) => {
      const applied = parseTime(application.dateApplied);
      return applied !== null && applied >= weekStart;
    }).length,
    appliedLast7Days,
    activeApplications: applications.filter((application) => !CLOSED_STAGES.has(application.status)).length,
    responseRate: rate(respondedCount, appliedApplications.length),
    interviewRate: rate(interviewCount, appliedApplications.length),
    offerRate: rate(offerCount, appliedApplications.length),
    staleCount: staleness.filter((result) => result.isStale).length,
    averageDaysToFirstResponse:
      responseDurations.length === 0
        ? null
        : responseDurations.reduce((total, value) => total + value, 0) / responseDurations.length,
    sourceCounts: [...sourceTotals.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((left, right) => right.count - left.count),
  };
}

export function computeStaleness(applications: Application[], now: Date = new Date()): SyncStaleness[] {
  return applications.map((application) => {
    const result = evaluateApplicationStaleness(application, now);
    return {
      applicationId: result.applicationId,
      isStale: result.isStale,
      daysSinceLastActivity: result.daysSinceLastActivity,
      suggestedAction: result.suggestedAction,
    };
  });
}

export function computeDeadlines(applications: Application[], now: Date = new Date()): SyncDeadline[] {
  return applications.map((application) => {
    const status = evaluateDeadline(application.deadline ?? null, now);
    return {
      applicationId: application.id,
      color: status.color,
      daysRemaining: status.daysRemaining,
      label: status.label,
    };
  });
}

export function computeFollowUps(applications: Application[], now: Date = new Date()): SyncFollowUp[] {
  return buildFollowUpSuggestions(applications, now).map((suggestion) => ({
    applicationId: suggestion.applicationId,
    company: suggestion.company,
    title: suggestion.title,
    kind: suggestion.kind,
    kindLabel: FOLLOW_UP_KIND_LABELS[suggestion.kind],
    messageTitle: suggestion.message.title,
    messageDescription: suggestion.message.description,
    messageBody: suggestion.message.body,
  }));
}

export function computeDuplicateGroups(applications: Application[]): SyncDuplicateGroup[] {
  return mixedSourceGroups(applications).map((group) => ({
    key: group.key,
    company: group.applications[0]?.company ?? "",
    title: group.applications[0]?.title ?? "",
    sources: [...new Set(group.applications.map((application) => application.source))],
    copies: group.applications.map((application) => ({
      applicationId: application.id,
      source: application.source,
      savedAt: application.createdAt,
    })),
  }));
}

export function computeToday(applications: Application[], now: Date = new Date()): SyncTodaySummary {
  return summarizeToday(applications, now);
}

export function buildSnapshotData(
  applications: Application[],
  events: ApplicationEvent[],
  recruiterSignals: SyncRecruiterSignal[],
  now: Date = new Date()
): SyncSnapshotData {
  const staleness = computeStaleness(applications, now);
  return {
    applications,
    events,
    staleness,
    deadlines: computeDeadlines(applications, now),
    today: computeToday(applications, now),
    followUps: computeFollowUps(applications, now),
    duplicateGroups: computeDuplicateGroups(applications),
    recruiterSignals,
    analytics: computeAnalytics(applications, events, staleness, now),
  };
}

export interface CollectionDiff<T> {
  upserted: T[];
  deletedIds: string[];
}

/** Diffs two id-keyed collections, treating `revisionOf` as the change marker. */
export function diffCollection<T extends { id: string }>(
  previous: T[],
  next: T[],
  revisionOf: (item: T) => string
): CollectionDiff<T> {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const upserted: T[] = [];
  for (const item of next) {
    const existing = previousById.get(item.id);
    if (!existing || revisionOf(existing) !== revisionOf(item)) upserted.push(item);
    previousById.delete(item.id);
  }
  return { upserted, deletedIds: [...previousById.keys()] };
}
