import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { applications, runMigrations } from "@ghostboard/database";
import { calendarDateOrNull, jobDetailBadges, jobDetailsOf } from "@ghostboard/shared";
import * as schema from "../../../../packages/database/src/schema";

const migrations = fileURLToPath(new URL("../../../../packages/database/migrations/", import.meta.url));

const NONE = {
  workArrangement: null, applicationDeadline: null, startDate: null, termDuration: null,
  responsibilities: [], preferredQualifications: [], education: null, workAuthorization: null, clearance: null,
};

test("the job_details column round-trips a full detail object through migration", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "job-details-"));
  const client = createClient({ url: `file:${path.join(directory, "test.db")}` });
  try {
    const db = drizzle(client, { schema });
    await runMigrations(db, migrations);
    const now = new Date().toISOString();
    const details = jobDetailsOf({
      ...NONE, workArrangement: "remote", termDuration: "12-week internship",
      clearance: "Active Secret", preferredQualifications: ["Kubernetes"],
    });

    await db.insert(applications).values({
      id: "a1", company: "Acme", title: "Intern", location: null,
      jobUrl: "https://example.com/jobs/1", jobDescription: "Build things.",
      status: "found", dateFound: now, lastActivityAt: now, source: "greenhouse",
      deadline: calendarDateOrNull("2026-10-31T00:00:00.000Z"),
      jobDetails: details ?? undefined, createdAt: now, updatedAt: now,
    });

    const [row] = await db.select().from(applications);
    assert.equal(row.jobDetails?.workArrangement, "remote");
    assert.equal(row.jobDetails?.clearance, "Active Secret");
    assert.deepEqual(row.jobDetails?.preferredQualifications, ["Kubernetes"]);
    assert.equal(row.deadline, "2026-10-31");

    // A row written before this column existed must still read cleanly.
    await db.insert(applications).values({
      id: "a2", company: "Legacy", title: "Older", location: null,
      jobUrl: "https://example.com/jobs/2", jobDescription: "x",
      status: "found", dateFound: now, lastActivityAt: now, source: "manual",
      createdAt: now, updatedAt: now,
    });
    const legacy = (await db.select().from(applications)).find((item) => item.id === "a2");
    assert.equal(legacy?.jobDetails ?? null, null);
    assert.deepEqual(jobDetailBadges(legacy?.jobDetails), []);
  } finally {
    client.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("a posting stating nothing collapses to null instead of an empty shell", () => {
  assert.equal(jobDetailsOf(NONE), null);
  assert.notEqual(jobDetailsOf({ ...NONE, clearance: "Active TS/SCI" }), null);
});

test("free-text deadlines never become fabricated calendar dates", () => {
  assert.equal(calendarDateOrNull("until filled"), null);
  assert.equal(calendarDateOrNull("2026-10-31T00:00:00.000Z"), "2026-10-31");
  assert.equal(calendarDateOrNull(null), null);
});

test("card badges prioritise arrangement, term, and clearance, and truncate long values", () => {
  const details = jobDetailsOf({
    ...NONE, workArrangement: "hybrid", termDuration: "Summer 2026, 12 weeks",
    clearance: "Active TS/SCI", startDate: "June",
  });
  assert.deepEqual(jobDetailBadges(details), ["hybrid", "Summer 2026, 12 weeks", "Active TS/SCI"]);
  assert.deepEqual(jobDetailBadges(details, 2), ["hybrid", "Summer 2026, 12 weeks"]);

  const long = jobDetailBadges(jobDetailsOf({ ...NONE, termDuration: "x".repeat(80) }));
  assert.equal(long[0].length, 42);
  assert.ok(long[0].endsWith("…"));
});
