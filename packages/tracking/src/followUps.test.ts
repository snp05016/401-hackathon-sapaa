import assert from "node:assert/strict";
import { test } from "node:test";
import type { Application } from "@ghostboard/shared";
import { buildFollowUpSuggestions, evaluateFollowUpKind } from "./followUps";

const now = new Date("2026-09-12T12:00:00.000Z");

function application(status: Application["status"], dateApplied: string | null, lastActivityAt: string): Application {
  return {
    id: status,
    company: "Test company",
    title: "Developer",
    location: null,
    jobUrl: "https://example.com/jobs/1",
    jobDescription: "",
    status,
    dateFound: "2026-09-01",
    dateApplied,
    lastActivityAt,
    followUpOn: false,
    nextAction: null,
    nextActionDate: null,
    resumeId: null,
    source: "manual",
    createdAt: "2026-09-01",
    updatedAt: "2026-09-01",
  };
}

const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

test("applied applications follow up after two weeks", () => {
  assert.equal(evaluateFollowUpKind(application("applied", daysAgo(14), daysAgo(14)), now), "application");
  assert.equal(evaluateFollowUpKind(application("applied", daysAgo(15), daysAgo(15)), now), "application");
  assert.equal(evaluateFollowUpKind(application("applied", daysAgo(13), daysAgo(13)), now), null);
});

test("applied applications without a date are never flagged", () => {
  assert.equal(evaluateFollowUpKind(application("applied", null, daysAgo(14)), now), null);
});

test("interviewed applications are thanked within 72 hours", () => {
  assert.equal(evaluateFollowUpKind(application("interviewing", daysAgo(10), hoursAgo(72)), now), "thank_you");
  assert.equal(evaluateFollowUpKind(application("interviewing", daysAgo(10), hoursAgo(48)), now), "thank_you");
  assert.equal(evaluateFollowUpKind(application("interviewing", daysAgo(10), hoursAgo(73)), now), null);
});

test("interviewed applications are followed up after a week", () => {
  assert.equal(evaluateFollowUpKind(application("interviewing", daysAgo(10), daysAgo(7)), now), "interview");
  assert.equal(evaluateFollowUpKind(application("interviewing", daysAgo(10), daysAgo(12)), now), "interview");
  assert.equal(evaluateFollowUpKind(application("interviewing", daysAgo(10), daysAgo(6)), now), null);
});

test("non-applied and non-interviewing stages are never flagged", () => {
  for (const status of ["found", "offer", "rejected", "ghosted"] as const) {
    assert.equal(evaluateFollowUpKind(application(status, daysAgo(20), daysAgo(20)), now), null);
  }
});

test("buildFollowUpSuggestions attaches a templated message per suggestion", () => {
  const suggestions = buildFollowUpSuggestions(
    [
      application("applied", daysAgo(14), daysAgo(14)),
      application("interviewing", daysAgo(10), hoursAgo(48)),
      application("interviewing", daysAgo(10), daysAgo(9)),
      application("applied", daysAgo(1), daysAgo(1)),
    ],
    now
  );
  assert.deepEqual(
    suggestions.map(({ kind, company, title }) => ({ kind, company, title })),
    [
      { kind: "application", company: "Test company", title: "Developer" },
      { kind: "thank_you", company: "Test company", title: "Developer" },
      { kind: "interview", company: "Test company", title: "Developer" },
    ]
  );
  assert.ok(suggestions.every(({ message }) => message.id && message.title && message.body && message.description));
});