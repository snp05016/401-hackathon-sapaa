import assert from "node:assert/strict";
import { test } from "node:test";
import type { Application } from "@ghostboard/shared";
import {
  DEFAULT_TRACKING_THRESHOLDS,
  evaluateApplicationStaleness,
  GHOSTABLE_STAGES,
  GHOSTED_INACTIVITY_DAYS,
  isGhostable,
  shouldAutoGhost,
  type TrackingThresholds,
} from "./staleness";

const now = new Date("2026-09-22T12:00:00Z");

function createApplication(
  status: Application["status"],
  lastActivityAt: string,
  dateApplied: string | null = null
): Application {
  return {
    id: `app-${status}`,
    company: "Acme Corp",
    title: "Software Engineer",
    location: "Remote",
    jobUrl: "https://example.com/job",
    jobDescription: "Description",
    status,
    dateFound: "2026-08-01",
    dateApplied,
    deadline: null,
    lastActivityAt,
    followUpOn: false,
    followUpDismissedAt: null,
    nextAction: null,
    nextActionDate: null,
    resumeId: null,
    source: "manual",
    createdAt: "2026-08-01",
    updatedAt: lastActivityAt,
  };
}

test("evaluateApplicationStaleness correctly identifies stale applications by stage", () => {
  // Found threshold: 7 days
  const freshFound = createApplication("found", "2026-09-18T12:00:00Z"); // 4 days
  assert.equal(evaluateApplicationStaleness(freshFound, now).isStale, false);
  const staleFound = createApplication("found", "2026-09-14T12:00:00Z"); // 8 days
  assert.equal(evaluateApplicationStaleness(staleFound, now).isStale, true);
  assert.equal(evaluateApplicationStaleness(staleFound, now).suggestedAction, "FOLLOW_UP_APPLICATION");

  // Applied threshold: 14 days
  const freshApplied = createApplication("applied", "2026-09-10T12:00:00Z"); // 12 days
  assert.equal(evaluateApplicationStaleness(freshApplied, now).isStale, false);
  const staleApplied = createApplication("applied", "2026-09-07T12:00:00Z"); // 15 days
  assert.equal(evaluateApplicationStaleness(staleApplied, now).isStale, true);
  assert.equal(evaluateApplicationStaleness(staleApplied, now).suggestedAction, "FOLLOW_UP_APPLICATION");

  // Interviewing threshold: 7 days
  const freshInterviewing = createApplication("interviewing", "2026-09-17T12:00:00Z"); // 5 days
  assert.equal(evaluateApplicationStaleness(freshInterviewing, now).isStale, false);
  const staleInterviewing = createApplication("interviewing", "2026-09-14T12:00:00Z"); // 8 days
  assert.equal(evaluateApplicationStaleness(staleInterviewing, now).isStale, true);
  assert.equal(evaluateApplicationStaleness(staleInterviewing, now).suggestedAction, "SEND_THANK_YOU_OR_CHECK_IN");

  // Offer threshold: 3 days
  const freshOffer = createApplication("offer", "2026-09-20T12:00:00Z"); // 2 days
  assert.equal(evaluateApplicationStaleness(freshOffer, now).isStale, false);
  const staleOffer = createApplication("offer", "2026-09-18T12:00:00Z"); // 4 days
  assert.equal(evaluateApplicationStaleness(staleOffer, now).isStale, true);
  assert.equal(evaluateApplicationStaleness(staleOffer, now).suggestedAction, "REVIEW_OFFER_DEADLINE");

  // Ghosted and Rejected are never stale
  const oldGhosted = createApplication("ghosted", "2026-08-01T12:00:00Z");
  assert.equal(evaluateApplicationStaleness(oldGhosted, now).isStale, false);
  assert.equal(evaluateApplicationStaleness(oldGhosted, now).suggestedAction, null);

  const oldRejected = createApplication("rejected", "2026-08-01T12:00:00Z");
  assert.equal(evaluateApplicationStaleness(oldRejected, now).isStale, false);
  assert.equal(evaluateApplicationStaleness(oldRejected, now).suggestedAction, null);
});

test("GHOSTABLE_STAGES covers applied and interviewing exclusively", () => {
  assert.equal(GHOSTED_INACTIVITY_DAYS, 21);
  assert.equal(isGhostable("applied"), true);
  assert.equal(isGhostable("interviewing"), true);
  assert.equal(isGhostable("found"), false);
  assert.equal(isGhostable("offer"), false);
  assert.equal(isGhostable("rejected"), false);
  assert.equal(isGhostable("ghosted"), false);
  assert.deepEqual(Array.from(GHOSTABLE_STAGES).sort(), ["applied", "interviewing"]);
});

test("shouldAutoGhost identifies applications inactive for 21+ days in ghostable stages", () => {
  // Applied: exactly 21 days ago -> true
  const applied21Days = createApplication("applied", "2026-09-01T12:00:00Z");
  assert.equal(shouldAutoGhost(applied21Days, now), true);

  // Applied: 25 days ago -> true
  const applied25Days = createApplication("applied", "2026-08-28T12:00:00Z");
  assert.equal(shouldAutoGhost(applied25Days, now), true);

  // Applied: 20 days ago -> false
  const applied20Days = createApplication("applied", "2026-09-02T12:00:00Z");
  assert.equal(shouldAutoGhost(applied20Days, now), false);

  // Interviewing: 22 days ago -> true
  const interviewing22Days = createApplication("interviewing", "2026-08-31T12:00:00Z");
  assert.equal(shouldAutoGhost(interviewing22Days, now), true);

  // Interviewing: 15 days ago -> false
  const interviewing15Days = createApplication("interviewing", "2026-09-07T12:00:00Z");
  assert.equal(shouldAutoGhost(interviewing15Days, now), false);

  // Other stages at 30 days ago -> always false
  const found30Days = createApplication("found", "2026-08-23T12:00:00Z");
  assert.equal(shouldAutoGhost(found30Days, now), false);

  const offer30Days = createApplication("offer", "2026-08-23T12:00:00Z");
  assert.equal(shouldAutoGhost(offer30Days, now), false);

  const rejected30Days = createApplication("rejected", "2026-08-23T12:00:00Z");
  assert.equal(shouldAutoGhost(rejected30Days, now), false);

  const ghosted30Days = createApplication("ghosted", "2026-08-23T12:00:00Z");
  assert.equal(shouldAutoGhost(ghosted30Days, now), false);
});

test("DEFAULT_TRACKING_THRESHOLDS matches expected defaults", () => {
  assert.deepEqual(DEFAULT_TRACKING_THRESHOLDS, {
    stageStalenessDays: {
      found: 7,
      applied: 14,
      interviewing: 7,
      offer: 3,
    },
    ghostedInactivityDays: 21,
  });
  assert.equal(GHOSTED_INACTIVITY_DAYS, DEFAULT_TRACKING_THRESHOLDS.ghostedInactivityDays);
});

test("evaluateApplicationStaleness respects custom thresholds", () => {
  const customThresholds: TrackingThresholds = {
    stageStalenessDays: {
      found: 3,
      applied: 5,
      interviewing: 2,
      offer: 1,
    },
    ghostedInactivityDays: 10,
  };

  // Found: 4 days ago -> Stale with custom (4 >= 3), but NOT with default (4 < 7)
  const found4Days = createApplication("found", "2026-09-18T12:00:00Z");
  assert.equal(evaluateApplicationStaleness(found4Days, now).isStale, false);
  assert.equal(evaluateApplicationStaleness(found4Days, now, customThresholds).isStale, true);

  // Applied: 6 days ago -> Stale with custom (6 >= 5), but NOT with default (6 < 14)
  const applied6Days = createApplication("applied", "2026-09-16T12:00:00Z");
  assert.equal(evaluateApplicationStaleness(applied6Days, now).isStale, false);
  assert.equal(evaluateApplicationStaleness(applied6Days, now, customThresholds).isStale, true);

  // Interviewing: 3 days ago -> Stale with custom (3 >= 2), but NOT with default (3 < 7)
  const interviewing3Days = createApplication("interviewing", "2026-09-19T12:00:00Z");
  assert.equal(evaluateApplicationStaleness(interviewing3Days, now).isStale, false);
  assert.equal(evaluateApplicationStaleness(interviewing3Days, now, customThresholds).isStale, true);

  // Offer: 2 days ago -> Stale with custom (2 >= 1), but NOT with default (2 < 3)
  const offer2Days = createApplication("offer", "2026-09-20T12:00:00Z");
  assert.equal(evaluateApplicationStaleness(offer2Days, now).isStale, false);
  assert.equal(evaluateApplicationStaleness(offer2Days, now, customThresholds).isStale, true);

  // Partial thresholds override only specified stages
  const partialThresholds: Partial<TrackingThresholds> = {
    stageStalenessDays: {
      found: 2,
      applied: 14,
      interviewing: 7,
      offer: 3,
    },
  };
  assert.equal(evaluateApplicationStaleness(found4Days, now, partialThresholds).isStale, true);
  assert.equal(evaluateApplicationStaleness(applied6Days, now, partialThresholds).isStale, false);
});

test("shouldAutoGhost respects custom thresholdDays", () => {
  // Applied 12 days ago: not ghosted with default 21, but ghosted with custom 10
  const applied12Days = createApplication("applied", "2026-09-10T12:00:00Z");
  assert.equal(shouldAutoGhost(applied12Days, now), false);
  assert.equal(shouldAutoGhost(applied12Days, now, 10), true);

  // Still false for non-ghostable stage even past custom threshold
  const found12Days = createApplication("found", "2026-09-10T12:00:00Z");
  assert.equal(shouldAutoGhost(found12Days, now, 10), false);
});

