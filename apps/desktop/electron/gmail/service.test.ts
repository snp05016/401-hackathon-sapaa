import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { applications, applicationEvents, gmailSuggestions, gmailSync, runMigrations } from "@ghostboard/database";
import * as schema from "../../../../packages/database/src/schema";
import { createGmailService } from "./service";
import type { GmailConnection } from "./store";

const currentTime = new Date("2026-09-12T12:00:00Z");
const migrations = fileURLToPath(new URL("../../../../packages/database/migrations/", import.meta.url));
function message(id: string, subject = "Acme Software Developer interview invitation", date = "2026-09-11T12:00:00Z") {
  return { id, threadId: `thread-${id}`, internalDate: String(Date.parse(date)), labelIds: ["INBOX"], payload: { mimeType: "text/plain", body: { data: Buffer.from(subject).toString("base64url") }, headers: [{ name: "Subject", value: subject }, { name: "From", value: "Acme Recruiting <jobs@acme.example>" }] } };
}
async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "gmail-service-"));
  const client = createClient({ url: `file:${path.join(directory, "test.db")}` });
  const db = drizzle(client, { schema });
  await runMigrations(db, migrations);
  await db.insert(applications).values({ id: "app1", company: "Acme", title: "Software Developer", jobUrl: "https://example.com/job", status: "applied", dateFound: "2026-09-01", dateApplied: "2026-09-02", lastActivityAt: "2026-09-02", createdAt: "2026-09-01", updatedAt: "2026-09-02", deadline: "2026-09-19" });
  let connection: GmailConnection | null = { credentials: { clientId: "test.apps.googleusercontent.com" }, tokens: { accessToken: "test-access", refreshToken: "test-refresh", expiresAt: Date.now() + 3600000 }, account: "test@example.com", automaticChecks: false };
  const calls: URL[] = [];
  let mock: (url: URL, init?: RequestInit) => Response | Promise<Response> = (url) => {
    if (url.pathname.endsWith("/profile")) return Response.json({ emailAddress: "test@example.com", historyId: "100" });
    if (url.pathname.endsWith("/messages")) return Response.json({ messages: [{ id: "m1" }] });
    if (url.pathname.endsWith("/history")) return Response.json({ historyId: "101", history: [{ messagesAdded: [{ message: { id: "m1" } }] }] });
    return Response.json(message("m1"));
  };
  const store = { load: async () => connection, save: async (value: GmailConnection) => { connection = value; }, clear: async () => { connection = null; } };
  const dependencies = { store, chooseCredentials: async () => ({ clientId: "test.apps.googleusercontent.com" }), openExternal: async () => {},
    authorize: async () => ({ accessToken: "test-access", refreshToken: "test-refresh", expiresAt: Date.now() + 3600000 }),
    provider: { complete: async (request: { messages: Array<{ content: string }> }) => {
      const input = JSON.parse(request.messages.at(-1)?.content ?? "{}") as { emails?: Array<{ messageId: string; subject: string }> };
      return { provider: "test", model: "test", text: JSON.stringify({ results: (input.emails ?? []).map((email) => ({
        messageId: email.messageId, recruiting: true,
        status: email.subject.includes("not be moving forward") ? "rejected" : "interviewing",
        applicationIds: ["app1"], confidence: 0.95, evidence: "Explicit recruiting status update",
      })) }) };
    } },
    now: () => currentTime, fetch: (async (input, init) => { const url = new URL(String(input)); calls.push(url); return mock(url, init); }) as typeof fetch };
  return { db, client, calls, store, dependencies, service: createGmailService(db, dependencies), setMock: (value: typeof mock) => { mock = value; }, setConnection: (value: GmailConnection | null) => { connection = value; }, cleanup: async () => { client.close(); await rm(directory, { recursive: true, force: true }); } };
}

test("checks create persistent suggestions without changing stages; apply is atomic and idempotent", async () => {
  const context = await fixture();
  try {
    let state = await context.service.check();
    assert.equal(state.error, null); assert.equal(state.suggestions.length, 1);
    assert.equal((await context.db.select().from(applications))[0].status, "applied");
    assert.equal(JSON.stringify(state).includes("test-access"), false);
    state = await createGmailService(context.db, context.dependencies).getState();
    assert.equal(state.suggestions.length, 1);
    const suggestion = state.suggestions[0];
    state = await context.service.apply(suggestion.id, "app1", "2026-09-02");
    assert.equal(state.error, null); assert.equal(state.suggestions.length, 0);
    const [application] = await context.db.select().from(applications);
    assert.equal(application.status, "interviewing"); assert.equal(application.deadline, "2026-09-19");
    assert.equal((await context.db.select().from(applicationEvents)).length, 2);
    await context.service.apply(suggestion.id, "app1", application.updatedAt);
    assert.equal((await context.db.select().from(applicationEvents)).length, 2);
    state = await context.service.check(); assert.equal(state.suggestions.length, 0);
  } finally { await context.cleanup(); }
});

test("dismissal survives rechecks and reconnecting the same account", async () => {
  const context = await fixture();
  try {
    const initial = await context.service.check();
    await context.service.dismiss(initial.suggestions[0].id);
    assert.equal((await context.service.check()).suggestions.length, 0);
    await context.service.disconnect();
    await context.service.connect();
    assert.equal((await context.service.check()).suggestions.length, 0);
    assert.equal((await context.db.select().from(applications))[0].status, "applied");
  } finally { await context.cleanup(); }
});

test("stale application snapshots and newer status evidence block an outdated suggestion", async () => {
  const context = await fixture();
  try {
    const initial = await context.service.check();
    const id = initial.suggestions[0].id;
    await context.db.update(applications).set({ updatedAt: "2026-09-12" });
    assert.match((await context.service.apply(id, "app1", "2026-09-02")).error!, /application changed/);
    await context.db.insert(applicationEvents).values({ id: "newer", applicationId: "app1", type: "stage_changed", title: "Newer decision", occurredAt: "2026-09-12", metadata: null });
    assert.match((await context.service.apply(id, "app1", "2026-09-12")).error!, /newer status/);
    assert.equal((await context.db.select().from(applications))[0].status, "applied");
    assert.equal((await context.db.select().from(gmailSuggestions))[0].decision, "pending");
  } finally { await context.cleanup(); }
});

test("failed event insertion rolls back status and decision", async () => {
  const context = await fixture();
  try {
    const initial = await context.service.check();
    await context.client.execute("CREATE TRIGGER fail_event BEFORE INSERT ON application_events WHEN NEW.type = 'stage_changed' BEGIN SELECT RAISE(ABORT, 'test failure'); END");
    const result = await context.service.apply(initial.suggestions[0].id, "app1", "2026-09-02");
    assert.ok(result.error);
    assert.equal((await context.db.select().from(applicationEvents)).length, 0);
    assert.equal((await context.db.select().from(applications))[0].status, "applied");
    assert.equal((await context.db.select().from(gmailSuggestions))[0].decision, "pending");
  } finally { await context.cleanup(); }
});

test("history pagination and failures never advance past unprocessed messages", async () => {
  const context = await fixture();
  try {
    await context.service.check();
    let fail = true;
    context.setMock((url) => {
      if (url.pathname.endsWith("/history")) {
        if (url.searchParams.get("pageToken") === "page2") return Response.json({ historyId: "103", history: [] });
        return Response.json({ historyId: "102", nextPageToken: "page2", history: [{ messagesAdded: [{ message: { id: "m2" } }] }] });
      }
      if (fail) return new Response("private content", { status: 503 });
      return Response.json(message("m2", "Acme: We will not be moving forward"));
    });
    assert.ok((await context.service.check()).error);
    assert.equal((await context.db.select().from(gmailSync))[0].historyId, "100");
    fail = false;
    const next = await context.service.check(); assert.equal(next.error, null); assert.equal(next.hasMore, true);
    assert.equal((await context.db.select().from(gmailSync))[0].historyId, "100");
    assert.equal((await context.service.check()).hasMore, false);
    assert.equal((await context.db.select().from(gmailSync))[0].historyId, "103");
    assert.ok(context.calls.some((url) => url.searchParams.get("pageToken") === "page2"));
  } finally { await context.cleanup(); }
});

test("polling is opt-in; disconnect removes tokens and pending email data", async () => {
  const context = await fixture();
  try {
    await context.service.poll(); assert.equal(context.calls.length, 0);
    await context.service.setAutomaticChecks(true);
    await context.service.poll(); assert.ok(context.calls.length > 0);
    const result = await context.service.disconnect();
    assert.equal(result.connected, false); assert.equal(result.account, null);
    assert.equal(await context.store.load(), null);
    assert.equal((await context.db.select().from(gmailSuggestions)).length, 0);
    assert.equal((await context.db.select().from(gmailSync)).length, 0);
  } finally { await context.cleanup(); }
});

test("connection requests only identify the account until the user checks emails", async () => {
  const context = await fixture();
  try {
    context.setConnection(null);
    const result = await context.service.connect();
    assert.equal(result.connected, true); assert.equal(result.automaticChecks, false);
    assert.equal(context.calls.length, 1); assert.ok(context.calls[0].pathname.endsWith("/profile"));
  } finally { await context.cleanup(); }
});
