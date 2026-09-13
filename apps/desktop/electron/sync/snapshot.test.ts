import assert from "node:assert/strict";
import test from "node:test";
import type { Application, ApplicationEvent } from "@ghostboard/shared";
import {
  buildSnapshotData,
  computeAnalytics,
  computeDuplicateGroups,
  computeStaleness,
  diffCollection,
} from "./snapshot";

const NOW = new Date("2026-03-20T12:00:00.000Z");

function application(overrides: Partial<Application> = {}): Application {
  return {
    id: "app-1",
    company: "Acme",
    title: "Engineer",
    location: null,
    jobUrl: "https://example.com/job",
    jobDescription: "",
    status: "applied",
    dateFound: "2026-03-01T12:00:00.000Z",
    dateApplied: "2026-03-02T12:00:00.000Z",
    deadline: null,
    lastActivityAt: "2026-03-02T12:00:00.000Z",
    followUpOn: false,
    followUpDismissedAt: null,
    nextAction: null,
    nextActionDate: null,
    resumeId: null,
    source: "extension",
    createdAt: "2026-03-01T12:00:00.000Z",
    updatedAt: "2026-03-02T12:00:00.000Z",
    ...overrides,
  };
}

function event(overrides: Partial<ApplicationEvent> = {}): ApplicationEvent {
  return {
    id: "event-1",
    applicationId: "app-1",
    type: "stage_changed",
    title: "Moved to Interviewing",
    description: null,
    occurredAt: "2026-03-06T12:00:00.000Z",
    metadata: null,
    ...overrides,
  };
}

test("diffCollection reports upserts and deletions by revision marker", () => {
  const previous = [application(), application({ id: "app-2" })];
  const next = [application({ updatedAt: "2026-03-10T12:00:00.000Z" }), application({ id: "app-3" })];

  const diff = diffCollection(previous, next, (item) => item.updatedAt);

  assert.deepEqual(
    diff.upserted.map((item) => item.id),
    ["app-1", "app-3"]
  );
  assert.deepEqual(diff.deletedIds, ["app-2"]);
});

test("diffCollection treats an unchanged row as no change", () => {
  const rows = [application()];
  const diff = diffCollection(rows, [application()], (item) => item.updatedAt);

  assert.deepEqual(diff.upserted, []);
  assert.deepEqual(diff.deletedIds, []);
});

test("staleness follows the desktop stage thresholds", () => {
  const results = computeStaleness(
    [
      application({ id: "fresh", lastActivityAt: "2026-03-19T12:00:00.000Z" }),
      application({ id: "stale", lastActivityAt: "2026-03-01T12:00:00.000Z" }),
    ],
    NOW
  );

  assert.equal(results.find((result) => result.applicationId === "fresh")?.isStale, false);
  const stale = results.find((result) => result.applicationId === "stale");
  assert.equal(stale?.isStale, true);
  assert.equal(stale?.daysSinceLastActivity, 19);
  assert.equal(stale?.suggestedAction, "FOLLOW_UP_APPLICATION");
});

test("analytics derive rates from applied applications only", () => {
  const applications = [
    application({ id: "a", status: "applied" }),
    application({ id: "b", status: "interviewing" }),
    application({ id: "c", status: "offer" }),
    application({ id: "d", status: "rejected" }),
    application({ id: "e", status: "found", dateApplied: null }),
  ];
  const analytics = computeAnalytics(applications, [], computeStaleness(applications, NOW), NOW);

  assert.equal(analytics.totalApplications, 5);
  assert.equal(analytics.responseRate, 3 / 4);
  assert.equal(analytics.interviewRate, 2 / 4);
  assert.equal(analytics.offerRate, 1 / 4);
  assert.equal(analytics.activeApplications, 4);
  assert.equal(analytics.stageCounts.find((entry) => entry.stage === "offer")?.count, 1);
});

test("analytics degrade to zero rather than NaN with no applied applications", () => {
  const analytics = computeAnalytics([], [], [], NOW);

  assert.equal(analytics.responseRate, 0);
  assert.equal(analytics.offerRate, 0);
  assert.equal(analytics.averageDaysToFirstResponse, null);
  assert.deepEqual(analytics.appliedLast7Days, [0, 0, 0, 0, 0, 0, 0]);
});

test("average days to first response measures post-apply events", () => {
  const applications = [application({ id: "app-1", dateApplied: "2026-03-02T12:00:00.000Z" })];
  const analytics = computeAnalytics(
    applications,
    [event({ occurredAt: "2026-03-06T12:00:00.000Z" })],
    computeStaleness(applications, NOW),
    NOW
  );

  assert.equal(analytics.averageDaysToFirstResponse, 4);
});

test("duplicate groups mirror the desktop's mixed-source grouping", () => {
  const applications = [
    application({ id: "a", source: "linkedin", jobUrl: "https://jobs.example.com/engineer" }),
    application({ id: "b", source: "greenhouse", jobUrl: "https://jobs.example.com/engineer" }),
    application({
      id: "c",
      company: "Globex",
      title: "Designer",
      source: "linkedin",
      jobUrl: "https://other.example.com/designer",
    }),
  ];

  const groups = computeDuplicateGroups(applications);

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0]?.sources.slice().sort(), ["greenhouse", "linkedin"]);
  assert.deepEqual(
    groups[0]?.copies.map((copy) => copy.applicationId).slice().sort(),
    ["a", "b"]
  );
});

test("a job saved once from one place is not a duplicate", () => {
  assert.deepEqual(computeDuplicateGroups([application({ id: "only" })]), []);
});

test("snapshot carries every collection the companion renders", () => {
  const applications = [application({ status: "applied", dateApplied: "2026-03-01T12:00:00.000Z", deadline: "2026-03-25" })];
  const snapshot = buildSnapshotData(applications, [event()], [], NOW);

  assert.equal(snapshot.applications.length, 1);
  assert.equal(snapshot.events.length, 1);
  assert.equal(snapshot.staleness.length, 1);
  assert.equal(snapshot.deadlines.length, 1);
  assert.equal(snapshot.deadlines[0]?.label, "Due in 5 days");
  assert.equal(snapshot.today.total, 1);
  assert.equal(snapshot.followUps.length, 1);
  assert.equal(snapshot.followUps[0]?.kind, "application");
  assert.deepEqual(snapshot.recruiterSignals, []);
  assert.deepEqual(snapshot.duplicateGroups, []);
});
