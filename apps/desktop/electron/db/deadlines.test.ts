import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { applications, runMigrations } from "@ghostboard/database";
import * as schema from "../../../../packages/database/src/schema";
import { updateApplicationDeadline } from "./deadlines";

const migrations = fileURLToPath(new URL("../../../../packages/database/migrations/", import.meta.url));

test("deadline migration preserves existing jobs and saves, clears, and survives reopen", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "deadline-test-"));
  let client = createClient({ url: `file:${path.join(directory, "test.db")}` });
  try {
    const oldMigrations = path.join(directory, "old-migrations");
    await mkdir(path.join(oldMigrations, "meta"), { recursive: true });
    const journal = JSON.parse(await readFile(path.join(migrations, "meta/_journal.json"), "utf8"));
    journal.entries = journal.entries.slice(0, 1);
    await writeFile(path.join(oldMigrations, "meta/_journal.json"), JSON.stringify(journal));
    await copyFile(path.join(migrations, `${journal.entries[0].tag}.sql`), path.join(oldMigrations, `${journal.entries[0].tag}.sql`));
    let db = drizzle(client, { schema });
    await runMigrations(db, oldMigrations);
    await client.execute(`INSERT INTO applications (id, company, title, job_url, date_found, last_activity_at, created_at, updated_at)
      VALUES ('existing', 'Existing company', 'Developer', 'https://example.com/jobs/1', '2020-01-01', '2020-01-01', '2020-01-01', '2020-01-01')`);
    await runMigrations(db, migrations);
    await runMigrations(db, migrations);
    const [existing] = await db.select().from(applications);
    assert.equal(existing?.deadline, null);
    assert.equal(existing?.company, "Existing company");
    const saved = await updateApplicationDeadline(db, "existing", "2026-09-19");
    assert.equal(saved.deadline, "2026-09-19");
    assert.equal(saved.status, "found");
    assert.equal(saved.lastActivityAt, "2020-01-01");
    assert.equal(saved.nextActionDate, null);
    assert.notEqual(saved.updatedAt, "2020-01-01");

    for (const invalid of [undefined, "2026-02-30", "2026-09-19T00:00:00Z", 123, {}, ""]) {
      await assert.rejects(updateApplicationDeadline(db, "existing", invalid), /valid deadline/);
    }
    await assert.rejects(updateApplicationDeadline(db, null, null), /saved job/);
    await assert.rejects(updateApplicationDeadline(db, "missing", null), /could not be found/);
    assert.equal((await db.select().from(applications))[0]?.deadline, "2026-09-19");

    client.close();
    client = createClient({ url: `file:${path.join(directory, "test.db")}` });
    db = drizzle(client, { schema });
    await runMigrations(db, migrations);
    assert.equal((await db.select().from(applications))[0]?.deadline, "2026-09-19");
    assert.equal((await updateApplicationDeadline(db, "existing", null)).deadline, null);
    assert.equal((await db.select().from(applications)).length, 1);
  } finally {
    client.close();
    await rm(directory, { recursive: true, force: true });
  }
});
