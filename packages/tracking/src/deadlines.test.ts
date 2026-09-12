import assert from "node:assert/strict";
import { test } from "node:test";
import type { Application } from "@ghostboard/shared";
import { evaluateDeadline, isValidDeadline, summarizeToday } from "./deadlines";

const now = new Date(2026, 8, 12, 23, 59);

function application(deadline: string | null | undefined, status: Application["status"] = "found"): Application {
  return {
    id: `${status}-${deadline}`, company: "Test company", title: "Developer", location: null,
    jobUrl: "https://example.com/jobs/1", jobDescription: "", status,
    dateFound: "2026-09-01", dateApplied: null, lastActivityAt: "2026-09-01",
    followUpOn: false,
    nextAction: null, nextActionDate: null, resumeId: null, source: "manual",
    createdAt: "2026-09-01", updatedAt: "2026-09-01", deadline,
  };
}

test("deadline colors and labels cover every boundary", () => {
  for (const [date, days, color, label] of [
    ["2026-09-20", 8, "green", "Due in 8 days"],
    ["2026-09-19", 7, "green", "Due in 7 days"],
    ["2026-09-18", 6, "yellow", "Due in 6 days"],
    ["2026-09-14", 2, "yellow", "Due in 2 days"],
    ["2026-09-13", 1, "red", "Due tomorrow"],
    ["2026-09-12", 0, "red", "Due today"],
    ["2026-09-11", -1, "red", "1 day overdue"],
    ["2026-09-10", -2, "red", "2 days overdue"],
  ] as const) {
    assert.deepEqual(evaluateDeadline(date, now), { color, daysRemaining: days, label });
  }
});

test("missing and impossible dates never appear as urgent deadlines", () => {
  for (const date of [undefined, null, ""]) {
    assert.deepEqual(evaluateDeadline(date, now), { color: "none", daysRemaining: null, label: "No deadline" });
  }
  for (const date of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-09-00", "2026-9-12", "2026-09-12T12:00:00Z", "invalid"]) {
    assert.equal(isValidDeadline(date), false, date);
    assert.equal(evaluateDeadline(date, now).color, "none", date);
  }
  for (const value of [null, undefined, 20260912, {}, []]) assert.equal(isValidDeadline(value), false);
  assert.equal(isValidDeadline("2028-02-29"), true);
});

test("calendar differences handle leap days, year rollover, local midnight, and DST", () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = "America/Edmonton";
  try {
    assert.equal(evaluateDeadline("2028-03-01", new Date(2028, 1, 28, 23, 59)).daysRemaining, 2);
    assert.equal(evaluateDeadline("2027-01-01", new Date(2026, 11, 31, 23, 59)).daysRemaining, 1);
    assert.equal(evaluateDeadline("2026-03-09", new Date(2026, 2, 7, 23, 59)).daysRemaining, 2);
    assert.equal(evaluateDeadline("2026-11-02", new Date(2026, 9, 31, 23, 59)).daysRemaining, 2);
    assert.equal(evaluateDeadline("2026-09-12", new Date("2026-09-13T05:59:00Z")).daysRemaining, 0);
    assert.equal(evaluateDeadline("2026-09-12", new Date("2026-09-13T06:00:00Z")).daysRemaining, -1);
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test("Today counts only unsubmitted Found jobs in non-overlapping deadline windows", () => {
  const jobs = [
    application("2026-09-12"), application("2026-09-11"), application("2026-09-13"),
    application("2026-09-19"), application("2026-09-20"), application(null), application(undefined),
    application("2026-09-12", "applied"), application("2026-09-12", "interviewing"),
    application("2026-09-11", "offer"), application("2026-09-12", "rejected"),
    application("2026-09-13", "ghosted"),
  ];
  assert.deepEqual(summarizeToday(jobs, now), {
    total: 12, applied: 1, interviewing: 1, dueToday: 1, upcoming: 2, overdue: 1, noDeadline: 2, followUpOn: 0,
  });
  assert.deepEqual(summarizeToday([], now), {
    total: 0, applied: 0, interviewing: 0, dueToday: 0, upcoming: 0, overdue: 0, noDeadline: 0, followUpOn: 0,
  });
});
