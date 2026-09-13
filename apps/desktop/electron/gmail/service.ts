import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { applications, applicationEvents, gmailSuggestions, gmailSync, type GhostboardDb } from "@ghostboard/database";
import { createEmailStatusProvider } from "@ghostboard/tracking";
import type { LLMProvider } from "@ghostboard/ai";
import type { Application, GmailCandidate, GmailState, GmailSuggestion } from "@ghostboard/shared";
import { authorizeGmail, googleJson, GmailRequestError, refreshGmailTokens, type GmailCredentials, type GmailTokens } from "./oauth";
import type { GmailConnection, GmailStore } from "./store";

interface GmailDependencies {
  store: GmailStore;
  chooseCredentials: () => Promise<GmailCredentials | null>;
  openExternal: (url: string) => Promise<void>;
  fetch?: typeof fetch;
  authorize?: (credentials: GmailCredentials, signal: AbortSignal) => Promise<GmailTokens>;
  provider?: Pick<LLMProvider, "complete">;
  now?: () => Date;
}
interface GmailProfile { emailAddress: string; historyId: string }
interface GmailHistory {
  historyId: string;
  nextPageToken?: string;
  history?: Array<{ messagesAdded?: Array<{ message: { id: string; labelIds?: string[] } }> }>;
}
const AUTOMATIC_UPDATE_CONFIDENCE = 0.85;

type GmailPipelineStatus = NonNullable<GmailSuggestion["newStatus"]>;

function normalized(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function canMoveForward(current: Application["status"], next: GmailPipelineStatus): boolean {
  if (current === next || current === "offer" || current === "rejected") return false;
  if (next === "rejected") return true;
  const rank: Record<"found" | "applied" | "interviewing" | "offer", number> = {
    found: 0, applied: 1, interviewing: 2, offer: 3,
  };
  const currentRank = current === "ghosted" ? 1 : rank[current];
  return rank[next] > currentRank;
}

function messageIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 1000 || value.some((id) => typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(id))) {
    throw new Error("Gmail returned an invalid or oversized message batch.");
  }
  return [...new Set(value as string[])];
}
function historyId(value: unknown): string {
  if (typeof value !== "string" || !/^\d{1,30}$/.test(value)) throw new Error("Gmail returned an invalid sync cursor.");
  return value;
}

export function createGmailService(db: GhostboardDb, dependencies: GmailDependencies) {
  const fetcher = dependencies.fetch ?? fetch;
  const now = dependencies.now ?? (() => new Date());
  let connection: GmailConnection | null | undefined;
  let busy = false;
  let error: string | null = null;
  let notice: string | null = null;
  let controller: AbortController | null = null;
  let stopped = false;

  async function load() {
    if (connection === undefined) connection = await dependencies.store.load();
    return connection;
  }
  async function save(value: GmailConnection) {
    await dependencies.store.save(value);
    connection = value;
  }
  async function accessToken(force = false): Promise<string> {
    const current = await load();
    if (!current?.tokens) throw new Error("Connect Gmail before checking messages.");
    if (force || current.tokens.expiresAt <= Date.now() + 60_000) {
      try {
        const tokens = await refreshGmailTokens(current.credentials, current.tokens, controller?.signal, fetcher);
        await save({ ...current, tokens });
      } catch (cause) {
        if (cause instanceof GmailRequestError && cause.status === 401) await save({ ...current, tokens: null, automaticChecks: false });
        throw cause;
      }
    }
    return connection!.tokens!.accessToken;
  }
  async function request<T>(url: string | URL): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await accessToken(attempt > 0);
      try { return await googleJson<T>(url, { headers: { authorization: `Bearer ${token}` }, signal: controller?.signal }, fetcher); }
      catch (cause) { if (!(cause instanceof GmailRequestError) || cause.status !== 401 || attempt > 0) throw cause; }
    }
    throw new Error("Reconnect Gmail to continue.");
  }
  async function getState(): Promise<GmailState> {
    let current: GmailConnection | null = null;
    try { current = await load(); } catch (cause) { error = cause instanceof Error ? cause.message : "Could not load Gmail settings."; }
    const account = current?.account ?? null;
    const [sync] = account ? await db.select().from(gmailSync).where(eq(gmailSync.account, account)) : [];
    const stored = account ? (await db.select().from(gmailSuggestions).where(eq(gmailSuggestions.account, account)))
      .filter((record) => record.decision !== "dismissed") : [];
    const jobs = new Map((await db.select().from(applications)).map((job) => [job.id, job]));
    const suggestions = stored.map(({ suggestion, decision }) => ({
      ...suggestion,
      decision: decision === "pending" ? "pending" as const : "applied" as const,
      candidates: suggestion.candidates.flatMap((candidate) => {
        const job = jobs.get(candidate.applicationId);
        return job ? [{ applicationId: job.id, company: job.company, title: job.title, status: job.status, updatedAt: job.updatedAt }] : [];
      }),
    })).sort((left, right) => right.receivedAt.localeCompare(left.receivedAt)).slice(0, 20);
    return {
      configured: !!current?.credentials, connected: !!current?.tokens, account,
      automaticChecks: current?.automaticChecks ?? false, recentOnly: current?.recentOnly ?? false,
      lastCheckedAt: sync?.lastCheckedAt ?? null,
      hasMore: !!sync?.pageToken || !!sync?.pendingIds.length
        || stored.some((record) => record.decision !== "dismissed" && !record.suggestion.action),
      busy, error, notice, suggestions,
    };
  }
  async function run(operation: () => Promise<void>): Promise<GmailState> {
    if (busy || stopped) return getState();
    busy = true;
    error = null;
    notice = null;
    controller = new AbortController();
    try { await operation(); }
    catch (cause) {
      error = controller.signal.aborted ? "Gmail operation cancelled."
        : cause instanceof Error ? cause.message : "Gmail could not complete this action. Try again.";
    } finally { busy = false; controller = null; }
    return getState();
  }

  async function check() {
    const current = await load();
    if (!current?.tokens || !current.account) throw new Error("Connect Gmail before checking messages.");
    const jobs = await db.select().from(applications);
    const account = current.account;
    const [savedSync] = await db.select().from(gmailSync).where(eq(gmailSync.account, account));
    const storedRecords = await db.select().from(gmailSuggestions).where(eq(gmailSuggestions.account, account));
    const legacyRecords = storedRecords
      .filter((record) => record.decision !== "dismissed" && !record.suggestion.action);
    const legacyMessageIds = legacyRecords.map((record) => record.messageId);
    let cursor = savedSync?.historyId || savedSync?.nextHistoryId || null;
    let nextCursor = savedSync?.nextHistoryId || savedSync?.historyId || null;
    let pageToken = savedSync?.pageToken ?? null;
    let pending = savedSync?.pendingIds ?? [];
    if (cursor && !pageToken) {
      const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/history");
      url.search = new URLSearchParams({ startHistoryId: cursor, historyTypes: "messageAdded", maxResults: "50" }).toString();
      try {
        const history = await request<GmailHistory>(url);
        nextCursor = historyId(history.historyId);
        if (history.nextPageToken !== undefined && (typeof history.nextPageToken !== "string" || history.nextPageToken.length > 4000)) throw new Error("Gmail returned an invalid page cursor.");
        pageToken = history.nextPageToken ?? null;
        if (history.history !== undefined && !Array.isArray(history.history)) throw new Error("Gmail returned invalid history.");
        const newIds = messageIds((history.history ?? []).flatMap((item) => (item.messagesAdded ?? [])
          .filter(({ message }) => {
            const labels = message.labelIds ?? [];
            return !labels.some((label) => ["DRAFT", "SPAM", "TRASH"].includes(label))
              && !(labels.includes("SENT") && !labels.includes("INBOX"));
          })
          .map(({ message }) => message.id)));
        pending = [...new Set([...newIds, ...pending])];
      } catch (cause) {
        if (!(cause instanceof GmailRequestError) || cause.status !== 404) throw cause;
        cursor = null;
        pageToken = null;
        notice = "Gmail's history expired. Checked up to 50 recent inbox messages to resume syncing; older messages may need manual review.";
      }
    } else if (cursor && pageToken) {
      const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/history");
      url.search = new URLSearchParams({ startHistoryId: cursor, historyTypes: "messageAdded", maxResults: "50", pageToken }).toString();
      try {
        const history = await request<GmailHistory>(url);
        nextCursor = historyId(history.historyId);
        pageToken = history.nextPageToken ?? null;
        if (history.history !== undefined && !Array.isArray(history.history)) throw new Error("Gmail returned invalid history.");
        const newIds = messageIds((history.history ?? []).flatMap((item) => (item.messagesAdded ?? [])
          .filter(({ message }) => {
            const labels = message.labelIds ?? [];
            return !labels.some((label) => ["DRAFT", "SPAM", "TRASH"].includes(label))
              && !(labels.includes("SENT") && !labels.includes("INBOX"));
          })
          .map(({ message }) => message.id)));
        pending = [...new Set([...newIds, ...pending])];
      } catch (cause) {
        if (!(cause instanceof GmailRequestError) || cause.status !== 404) throw cause;
        cursor = null;
        pageToken = null;
      }
    }
    if (!cursor && !pending.length) {
      const profile = await request<GmailProfile>("https://gmail.googleapis.com/gmail/v1/users/me/profile");
      nextCursor = historyId(profile.historyId);
      cursor = nextCursor;
      const initialUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
      initialUrl.search = new URLSearchParams({ q: "in:inbox newer_than:90d -category:promotions -category:social", maxResults: current.recentOnly ? "10" : "50", includeSpamTrash: "false" }).toString();
      const listed = await request<{ messages?: Array<{ id: string }> }>(initialUrl);
      pending = messageIds((listed.messages ?? []).map((message) => message.id));
      notice ??= "Checked up to 50 recent inbox messages. Future checks follow new mail; attachments are not read.";
    }
    if (current.recentOnly) {
      pending = pending.slice(0, 10);
      pageToken = null;
    }
    const eligibleLegacyIds = current.recentOnly
      ? legacyMessageIds.filter((messageId) => pending.includes(messageId))
      : legacyMessageIds;
    const batch = [...new Set([...eligibleLegacyIds, ...pending])].slice(0, 10);
    const provider = createEmailStatusProvider({
      getAccessToken: () => accessToken(), messageIds: batch, lookbackDays: 90, now,
      provider: dependencies.provider,
      fetch: async (input) => {
        try {
          const value = await request<unknown>(String(input));
          return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
        } catch (cause) {
          if (cause instanceof GmailRequestError && cause.status === 404) {
            // A message deleted between history and retrieval has no usable evidence.
            return new Response(JSON.stringify({ id: "deleted", labelIds: ["TRASH"] }), { status: 200 });
          }
          throw cause;
        }
      },
    });
    const updates = await provider.checkForUpdates(jobs);
    const processedIds = new Set(batch);
    pending = pending.filter((messageId) => !processedIds.has(messageId));
    const remainingLegacy = eligibleLegacyIds.filter((messageId) => !processedIds.has(messageId));
    const finished = !pending.length && !pageToken;
    const checkedAt = now().toISOString();
    let moved = 0;
    let created = 0;
    let noticed = 0;
    await db.transaction(async (transaction) => {
      for (const record of storedRecords) {
        const saved = record.suggestion;
        if (record.decision !== "applied" || !saved.newStatus || saved.confidence < AUTOMATIC_UPDATE_CONFIDENCE
          || !["moved", "created"].includes(saved.action ?? "") || saved.candidates.length !== 1) continue;
        const candidate = saved.candidates[0];
        const [application] = await transaction.select().from(applications).where(eq(applications.id, candidate.applicationId));
        if (!application || !canMoveForward(application.status, saved.newStatus)) continue;
        const restoredAt = now().toISOString();
        const restoreKey = createHash("sha256").update(application.updatedAt).digest("hex").slice(0, 16);
        await transaction.insert(applicationEvents).values({
          id: `gmail:${record.id}:restore:${restoreKey}`,
          applicationId: application.id,
          type: "stage_changed",
          title: `Restored to ${saved.newStatus}`,
          description: "Restored from a previously confirmed high-confidence Gmail update",
          occurredAt: restoredAt,
          metadata: { source: "gmail", messageId: saved.messageId, threadId: saved.threadId, gmailReceivedAt: saved.receivedAt, automatic: true, fromStage: application.status, toStage: saved.newStatus },
        }).onConflictDoNothing();
        await transaction.update(applications).set({
          status: saved.newStatus,
          updatedAt: restoredAt,
          dateApplied: application.dateApplied ?? saved.receivedAt,
          lastActivityAt: Date.parse(application.lastActivityAt) > Date.parse(saved.receivedAt) ? application.lastActivityAt : saved.receivedAt,
        }).where(eq(applications.id, application.id));
        const index = jobs.findIndex((job) => job.id === application.id);
        if (index >= 0) jobs[index] = { ...application, status: saved.newStatus, updatedAt: restoredAt };
        moved++;
      }
      for (const update of updates) {
        const id = createHash("sha256").update(`${account}\0${update.messageId}`).digest("hex");
        let candidates = update.candidates;
        if (!candidates.length && update.company && update.title) {
          const matches = jobs.filter((job) => normalized(job.company) === normalized(update.company!) && normalized(job.title) === normalized(update.title!));
          if (matches.length === 1) {
            const job = matches[0];
            candidates = [{ applicationId: job.id, company: job.company, title: job.title, status: job.status, updatedAt: job.updatedAt }];
          }
        }
        let suggestion: GmailSuggestion = {
          id, messageId: update.messageId, threadId: update.threadId, receivedAt: update.receivedAt,
          subject: update.subject, sender: update.sender, newStatus: update.newStatus,
          confidence: update.confidence, evidence: update.evidence ?? "", candidates, action: "noticed",
        };
        const [existing] = await transaction.select().from(gmailSuggestions).where(eq(gmailSuggestions.id, id));
        if (existing?.suggestion.action || existing?.decision === "dismissed") continue;
        const candidate = candidates.length === 1 ? candidates[0] : null;
        let [application] = candidate
          ? await transaction.select().from(applications).where(eq(applications.id, candidate.applicationId))
          : [];
        const confident = !!update.newStatus && update.confidence >= AUTOMATIC_UPDATE_CONFIDENCE;
        const reviewedAt = now().toISOString();

        const effectiveTitle = update.title || (update.company ? `Role at ${update.company}` : "Candidate");
        if (!application && confident && update.company) {
          const applicationId = `gmail-${id}`;
          application = {
            id: applicationId,
            company: update.company,
            title: effectiveTitle,
            location: null,
            jobUrl: `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(update.threadId)}`,
            jobDescription: "",
            // Gmail-derived applications never went through job-page ingestion.
            jobDetails: null,
            status: update.newStatus!,
            dateFound: update.receivedAt,
            dateApplied: update.receivedAt,
	            deadline: null,
	            lastActivityAt: update.receivedAt,
	            followUpOn: false,
	            followUpDismissedAt: null,
	            nextAction: null,
            nextActionDate: null,
            resumeId: null,
            source: "gmail",
            createdAt: reviewedAt,
            updatedAt: reviewedAt,
          };
          const createdCandidate: GmailCandidate = {
            applicationId, company: application.company, title: application.title,
            status: application.status, updatedAt: application.updatedAt,
          };
          suggestion = { ...suggestion, candidates: [createdCandidate], action: "created" };
          const metadata = { source: "gmail", messageId: update.messageId, threadId: update.threadId, gmailReceivedAt: update.receivedAt, automatic: true };
          await transaction.insert(applications).values(application).onConflictDoNothing();
          await transaction.insert(applicationEvents).values([
            { id: `gmail:${id}:created`, applicationId, type: "created", title: `Added from Gmail in ${update.newStatus}`, description: update.evidence, occurredAt: reviewedAt, metadata },
            { id: `gmail:${id}:email`, applicationId, type: "email_received", title: update.subject, description: update.evidence, occurredAt: update.receivedAt, metadata },
          ]).onConflictDoNothing();
          jobs.push(application);
          created++;
        } else if (application && candidate && confident && canMoveForward(application.status, update.newStatus!)) {
          suggestion = { ...suggestion, action: "moved" };
          const metadata = { source: "gmail", messageId: update.messageId, threadId: update.threadId, gmailReceivedAt: update.receivedAt, reviewedAt, automatic: true };
          await transaction.insert(applicationEvents).values([
            { id: `gmail:${id}:email`, applicationId: application.id, type: "email_received", title: update.subject, description: update.evidence, occurredAt: update.receivedAt, metadata },
            { id: `gmail:${id}:stage`, applicationId: application.id, type: "stage_changed", title: `Moved to ${update.newStatus}`, description: "Applied automatically from a high-confidence Gmail match", occurredAt: reviewedAt, metadata: { ...metadata, fromStage: application.status, toStage: update.newStatus } },
          ]).onConflictDoNothing();
          await transaction.update(applications).set({
            status: update.newStatus!, updatedAt: reviewedAt,
            dateApplied: application.dateApplied ?? update.receivedAt,
            lastActivityAt: Date.parse(application.lastActivityAt) > Date.parse(update.receivedAt) ? application.lastActivityAt : update.receivedAt,
          }).where(eq(applications.id, application.id));
          const index = jobs.findIndex((job) => job.id === application!.id);
          if (index >= 0) jobs[index] = { ...application, status: update.newStatus!, updatedAt: reviewedAt };
          moved++;
        } else if (application && candidate && confident
          && application.status === "interviewing" && update.newStatus === "interviewing") {
          // A later interview email is new activity even though it does not move
          // the pipeline. Advancing this anchor lets a previously dismissed
          // thank-you/follow-up reminder become eligible again.
          const metadata = { source: "gmail", messageId: update.messageId, threadId: update.threadId, gmailReceivedAt: update.receivedAt, reviewedAt, automatic: true };
          await transaction.insert(applicationEvents).values({
            id: `gmail:${id}:email`, applicationId: application.id, type: "email_received",
            title: update.subject, description: update.evidence, occurredAt: update.receivedAt, metadata,
          }).onConflictDoNothing();
          const lastActivityAt = Date.parse(application.lastActivityAt) > Date.parse(update.receivedAt)
            ? application.lastActivityAt
            : update.receivedAt;
          await transaction.update(applications).set({ lastActivityAt, updatedAt: reviewedAt }).where(eq(applications.id, application.id));
          const index = jobs.findIndex((job) => job.id === application!.id);
          if (index >= 0) jobs[index] = { ...application, lastActivityAt, updatedAt: reviewedAt };
          noticed++;
        } else {
          noticed++;
        }
        if (existing) {
          await transaction.update(gmailSuggestions).set({ suggestion, decision: "applied" }).where(eq(gmailSuggestions.id, id));
        } else {
          await transaction.insert(gmailSuggestions).values({ id, account, messageId: update.messageId, suggestion, decision: "applied" });
        }
      }
      const returnedMessageIds = new Set(updates.map((update) => update.messageId));
      for (const record of legacyRecords) {
        if (!processedIds.has(record.messageId) || returnedMessageIds.has(record.messageId)) continue;
        await transaction.update(gmailSuggestions).set({
          suggestion: { ...record.suggestion, action: "noticed" }, decision: "applied",
        }).where(eq(gmailSuggestions.id, record.id));
        noticed++;
      }
      const sync = {
        account, historyId: finished ? nextCursor : (cursor ?? nextCursor), nextHistoryId: finished ? null : nextCursor,
        pendingIds: pending, pageToken, lastCheckedAt: checkedAt,
      };
      await transaction.insert(gmailSync).values(sync).onConflictDoUpdate({ target: gmailSync.account, set: sync });
    });
    if (remainingLegacy.length) notice = `Rechecked ${batch.length} earlier recruiter messages. Click Check next batch to finish ${remainingLegacy.length} more.`;
    else if (moved || created || noticed) {
      const parts = [moved && `moved ${moved} job${moved === 1 ? "" : "s"}`, created && `added ${created} job${created === 1 ? "" : "s"}`, noticed && `${noticed} heads-up${noticed === 1 ? "" : "s"}`].filter(Boolean);
      notice = `Gmail ${parts.join(", ")}.`;
    } else if (batch.length > 0) {
      notice = finished
        ? `Checked ${batch.length} message${batch.length === 1 ? "" : "s"} with Antigravity. No recruiter or status updates found.`
        : `Checked ${batch.length} message${batch.length === 1 ? "" : "s"} with Antigravity (${pending.length} remaining in queue). None were recruiter updates. Click check next batch to continue.`;
    }
  }

  return {
    getState,
    importCredentials: () => run(async () => {
      if (connection?.tokens) throw new Error("Disconnect Gmail before replacing the Google credentials.");
      const credentials = await dependencies.chooseCredentials();
      if (!credentials) return;
      await save({ credentials, tokens: null, account: null, automaticChecks: false });
      notice = "Credentials imported. Click Connect Gmail to sign in.";
    }),
    connect: () => run(async () => {
      let current = await load();
      if (!current) {
        const credentials = await dependencies.chooseCredentials();
        if (!credentials) return;
        current = { credentials, tokens: null, account: null, automaticChecks: false };
        // Verify encrypted storage before opening the browser.
        await save(current);
      }
      const tokens = dependencies.authorize
        ? await dependencies.authorize(current.credentials, controller!.signal)
        : await authorizeGmail(current.credentials, dependencies.openExternal, controller!.signal, fetcher);
      const profile = await googleJson<GmailProfile>("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { authorization: `Bearer ${tokens.accessToken}` }, signal: controller!.signal,
      }, fetcher);
      if (typeof profile.emailAddress !== "string" || !/^[^\s@]+@[^\s@]+$/.test(profile.emailAddress)) throw new Error("Google did not identify the connected Gmail account.");
      await save({ ...current, tokens, account: profile.emailAddress.toLowerCase(), automaticChecks: false });
      notice = "Gmail connected. Click Check Gmail when you are ready to classify recent messages.";
    }),
    check: () => run(check),
    setAutomaticChecks: (enabled: unknown) => run(async () => {
      if (typeof enabled !== "boolean") throw new Error("Choose whether automatic checks are enabled.");
      const current = await load();
      if (!current?.tokens) throw new Error("Connect Gmail first.");
      await save({ ...current, automaticChecks: enabled });
    }),
    setRecentOnly: (enabled: unknown) => run(async () => {
      if (typeof enabled !== "boolean") throw new Error("Choose whether Gmail should check only the 10 newest messages.");
      const current = await load();
      if (!current?.tokens) throw new Error("Connect Gmail first.");
      await save({ ...current, recentOnly: enabled });
      notice = enabled ? "Gmail checks are limited to the 10 newest queued messages." : "Gmail checks will continue through the full queued inbox scan.";
    }),
    disconnect: () => run(async () => {
      const current = await load();
      const token = current?.tokens?.refreshToken;
      // Local access is removed even if Google's revocation service is unavailable.
      await dependencies.store.clear();
      connection = null;
      if (current?.account) {
        await db.delete(gmailSuggestions).where(eq(gmailSuggestions.account, current.account));
        await db.delete(gmailSync).where(eq(gmailSync.account, current.account));
      }
      if (token) {
        try {
          const response = await fetcher("https://oauth2.googleapis.com/revoke", {
            method: "POST", body: new URLSearchParams({ token }), signal: AbortSignal.timeout(10_000), redirect: "error",
          });
          if (!response.ok && response.status !== 400) throw new Error();
        } catch { notice = "Disconnected locally. Google could not confirm revocation; you can also remove this app in your Google Account connections."; }
      }
    }),
    dismiss: (id: unknown) => run(async () => {
      const current = await load();
      if (typeof id !== "string" || !current?.account) throw new Error("Choose a Gmail suggestion to dismiss.");
      await db.update(gmailSuggestions).set({ decision: "dismissed" }).where(and(eq(gmailSuggestions.id, id), eq(gmailSuggestions.account, current.account), eq(gmailSuggestions.decision, "pending")));
    }),
    apply: (id: unknown, applicationId: unknown, expectedUpdatedAt: unknown) => run(async () => {
      const current = await load();
      if (!current?.account || typeof id !== "string" || typeof applicationId !== "string" || typeof expectedUpdatedAt !== "string") throw new Error("Choose a matched application before applying an update.");
      const account = current.account;
      await db.transaction(async (transaction) => {
        const [record] = await transaction.select().from(gmailSuggestions).where(and(eq(gmailSuggestions.id, id), eq(gmailSuggestions.account, account)));
        if (!record) throw new Error("This Gmail suggestion was not found.");
        if (record.decision !== "pending") return;
        const suggestion = record.suggestion;
        if (!suggestion.newStatus) throw new Error("This recruiter message does not propose a stage change.");
        if (!suggestion.candidates.some((candidate) => candidate.applicationId === applicationId)) throw new Error("Choose one of the matching applications.");
        const [application] = await transaction.select().from(applications).where(eq(applications.id, applicationId));
        if (!application) throw new Error("The matched application no longer exists.");
        if (application.updatedAt !== expectedUpdatedAt) throw new Error("This application changed. Review its current stage and try again.");
        if (["offer", "rejected"].includes(application.status) || application.status === suggestion.newStatus) throw new Error("This application is already in that stage or is closed. Dismiss this suggestion if it no longer applies.");
        const events = await transaction.select().from(applicationEvents).where(eq(applicationEvents.applicationId, applicationId));
        if (events.some((event) => event.type === "stage_changed" && Date.parse(String(event.metadata?.gmailReceivedAt ?? event.occurredAt)) > Date.parse(suggestion.receivedAt))) {
          throw new Error("A newer status update exists for this application. Dismiss this older email suggestion.");
        }
        const reviewedAt = now().toISOString();
        const metadata = { source: "gmail", messageId: suggestion.messageId, threadId: suggestion.threadId, gmailReceivedAt: suggestion.receivedAt, reviewedAt };
        await transaction.insert(applicationEvents).values([
          { id: `gmail:${id}:email`, applicationId, type: "email_received", title: suggestion.subject, description: suggestion.evidence, occurredAt: suggestion.receivedAt, metadata },
          { id: `gmail:${id}:stage`, applicationId, type: "stage_changed", title: `Moved to ${suggestion.newStatus}`, description: "Confirmed Gmail suggestion", occurredAt: reviewedAt, metadata: { ...metadata, fromStage: application.status, toStage: suggestion.newStatus } },
        ]);
        await transaction.update(applications).set({
          status: suggestion.newStatus, updatedAt: reviewedAt,
          lastActivityAt: Date.parse(application.lastActivityAt) > Date.parse(suggestion.receivedAt) ? application.lastActivityAt : suggestion.receivedAt,
        }).where(eq(applications.id, applicationId));
        await transaction.update(gmailSuggestions).set({ decision: "applied" }).where(eq(gmailSuggestions.id, id));
      });
      notice = "Application status updated and the email recorded in its activity history.";
    }),
    cancel: () => { controller?.abort(); },
    poll: async () => {
      if (busy || stopped) return;
      try { if ((await load())?.automaticChecks) await run(check); }
      catch { error = "Could not run the automatic Gmail check. Open Tracking to reconnect or try again."; }
    },
    stop: () => { stopped = true; controller?.abort(); },
  };
}
