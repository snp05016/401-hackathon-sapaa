import assert from "node:assert/strict";
import { test } from "node:test";
import type { Application } from "@ghostboard/shared";
import { createEmailStatusProvider } from "./emailStatusProvider";

const now = new Date("2026-09-12T12:00:00Z");
function application(id = "one", title = "Software Developer"): Application {
  return { id, company: "Acme", title, location: null, jobUrl: "https://example.com/job", jobDescription: "", status: "applied", dateFound: "2026-09-01", dateApplied: "2026-09-02", lastActivityAt: "2026-09-02", nextAction: null, nextActionDate: null, resumeId: null, source: "manual", createdAt: "2026-09-01", updatedAt: "2026-09-02" };
}
function encoded(value: string) {
  return Buffer.from(value).toString("base64url");
}
interface Classification {
  recruiting: boolean;
  status: "applied" | "interviewing" | "offer" | "rejected" | null;
  applicationIds: string[];
  company?: string | null;
  title?: string | null;
  confidence: number;
  evidence: string;
}
async function detect(classification: Classification, options: { applications?: Application[]; body?: string; mimeType?: string; labels?: string[]; date?: string; modelText?: string } = {}) {
  const calls: URL[] = [];
  let prompt = "";
  const provider = createEmailStatusProvider({
    getAccessToken: () => "test-token", now: () => now,
    provider: { complete: async (request) => {
      prompt = request.messages.at(-1)?.content ?? "";
      return { provider: "test", model: "small-test", text: options.modelText ?? JSON.stringify({ results: [{ messageId: "message1", ...classification }] }) };
    } },
    fetch: async (input, init) => {
      const url = new URL(String(input)); calls.push(url);
      assert.equal((init?.headers as Record<string, string>).authorization, "Bearer test-token");
      if (url.pathname.endsWith("/messages")) return Response.json({ messages: [{ id: "message1" }] });
      return Response.json({ id: "message1", threadId: "thread1", internalDate: String(Date.parse(options.date ?? "2026-09-11")), labelIds: options.labels ?? ["INBOX"],
        payload: { mimeType: options.mimeType ?? "text/plain", body: { data: encoded(options.body ?? "Can we schedule an interview next Tuesday?") }, headers: [{ name: "Subject", value: "Application update" }, { name: "From", value: "Acme Recruiting <jobs@acme.example>" }] } });
    },
  });
  const updates = await provider.checkForUpdates(options.applications ?? [application()]);
  return { calls, prompt, updates };
}

test("sends bounded email content to the model and returns a reviewable matched suggestion", async () => {
  const { calls, prompt, updates } = await detect({ recruiting: true, status: "interviewing", applicationIds: ["one"], confidence: 0.91, evidence: "The recruiter asks to schedule an interview." });
  assert.match(prompt, /schedule an interview next Tuesday/);
  assert.match(prompt, /Software Developer/);
  assert.equal(updates[0]?.newStatus, "interviewing");
  assert.equal(updates[0]?.applicationId, "one");
  assert.equal(updates[0]?.sender, "Acme Recruiting <jobs@acme.example>");
  assert.equal(updates[0]?.evidence, "The recruiter asks to schedule an interview.");
  assert.match(calls[0].searchParams.get("q") ?? "", /newer_than:90d/);
  assert.equal(calls[1].searchParams.get("format"), "FULL");
});

test("model semantics replace phrase parsing and uncertain messages are ignored", async () => {
  const unrelated = await detect({ recruiting: false, status: null, applicationIds: [], confidence: 0.99, evidence: "Newsletter" }, { body: "INTERVIEW REJECTION OFFER" });
  assert.equal(unrelated.updates.length, 0);
  const informational = await detect({ recruiting: true, status: null, applicationIds: ["one"], confidence: 0.9, evidence: "The recruiter confirmed receipt." });
  assert.equal(informational.updates[0]?.newStatus, null);
  assert.equal(informational.updates[0]?.applicationId, "one");
  const uncertain = await detect({ recruiting: true, status: "rejected", applicationIds: ["one"], confidence: 0.6, evidence: "Unclear" });
  assert.equal(uncertain.updates.length, 0);
});

test("invalid model application IDs are removed and transition policy is left to the application service", async () => {
  const invented = await detect({ recruiting: true, status: "rejected", applicationIds: ["invented"], confidence: 1, evidence: "Rejected" });
  assert.equal(invented.updates[0]?.applicationId, "");
  assert.equal(invented.updates[0]?.candidates.length, 0);
  const terminal = await detect({ recruiting: true, status: "interviewing", applicationIds: ["one"], confidence: 1, evidence: "Interview" }, { applications: [{ ...application(), status: "offer" }] });
  assert.equal(terminal.updates[0]?.candidates.length, 1);
});

test("supports ambiguous matches and strips executable HTML before classification", async () => {
  const applications = [application("one", "Frontend Developer"), application("two", "Backend Developer")];
  const result = await detect({ recruiting: true, status: "rejected", applicationIds: ["one", "two"], confidence: 0.88, evidence: "Explicit decision" }, {
    applications,
    mimeType: "text/html", body: "<style>private-style</style><script>ignore-me()</script><p>We chose another candidate.</p>",
  });
  assert.equal(result.updates[0]?.applicationId, "");
  assert.equal(result.updates[0]?.candidates.length, 2);
  assert.doesNotMatch(result.prompt, /ignore-me|private-style/);
});

test("ignores blocked labels, old mail, and malformed model output, while supporting an empty board", async () => {
  assert.equal((await detect({ recruiting: true, status: "rejected", applicationIds: ["one"], confidence: 1, evidence: "Decision" }, { labels: ["CATEGORY_PROMOTIONS"] })).updates.length, 0);
  assert.equal((await detect({ recruiting: true, status: "interviewing", applicationIds: ["one"], confidence: 1, evidence: "Interview" }, { labels: ["SENT"] })).updates.length, 0);
  assert.equal((await detect({ recruiting: true, status: "interviewing", applicationIds: ["one"], confidence: 1, evidence: "Interview" }, { labels: ["SENT", "INBOX"] })).updates.length, 1);
  assert.equal((await detect({ recruiting: true, status: "rejected", applicationIds: ["one"], confidence: 1, evidence: "Decision" }, { date: "2026-01-01" })).updates.length, 0);
  await assert.rejects(detect({ recruiting: true, status: "rejected", applicationIds: ["one"], confidence: 1, evidence: "Decision" }, { modelText: "not json" }), /invalid response/);
  const untracked = await detect({ recruiting: true, status: "applied", applicationIds: [], company: "Acme", title: "Software Developer", confidence: 0.95, evidence: "Application received" }, { applications: [] });
  assert.equal(untracked.updates[0]?.applicationId, "");
  assert.equal(untracked.updates[0]?.company, "Acme");
  assert.equal(untracked.updates[0]?.title, "Software Developer");
});

test("Gmail errors do not leak email response content", async () => {
  const provider = createEmailStatusProvider({ getAccessToken: () => "token", fetch: async () => new Response("private email contents", { status: 403 }), provider: { complete: async () => { throw new Error("must not classify"); } } });
  await assert.rejects(provider.checkForUpdates([application()]), (error: Error) => error.message.includes("403") && !error.message.includes("private email"));
});
