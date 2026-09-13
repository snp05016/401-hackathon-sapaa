import type { ExtensionMessage } from "../shared/messages";
import type { IngestJobResponse, JobPosting } from "@ghostboard/shared";
import { getProfileFromBridge, getResumeTemplateFromBridge, getTailoredResumeFromBridge, postJson, startBridgeMessageReceiver } from "./bridgeClient";

// ponytail: in-memory per-tab state, resets on service-worker restart — fine for a hackathon popup
const detectedJobByTab = new Map<number, { job: JobPosting; confidence: number }>();
const RECENT_JOBS_KEY = "ghostboardRecentJobsByTab";
const RECENT_JOB_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

interface RecentJob {
  job: JobPosting;
  savedAt: string;
}

async function rememberRecentJob(tabId: number, job: JobPosting): Promise<void> {
  const stored = await chrome.storage.local.get(RECENT_JOBS_KEY);
  const recent = (stored[RECENT_JOBS_KEY] ?? {}) as Record<string, RecentJob>;
  const entry = { job, savedAt: new Date().toISOString() };
  recent[String(tabId)] = entry;
  recent.latest = entry;
  await chrome.storage.local.set({ [RECENT_JOBS_KEY]: recent });
}

async function recentJob(tabId: number | undefined): Promise<JobPosting | null> {
  if (tabId === undefined) return null;
  const live = detectedJobByTab.get(tabId)?.job;
  if (live) return live;
  const stored = await chrome.storage.local.get(RECENT_JOBS_KEY);
  const recent = (stored[RECENT_JOBS_KEY] ?? {}) as Record<string, RecentJob>;
  const entry = recent[String(tabId)] ?? recent.latest;
  if (!entry?.job || !entry.savedAt || Date.now() - Date.parse(entry.savedAt) > RECENT_JOB_MAX_AGE_MS) return null;
  return entry.job;
}

startBridgeMessageReceiver();

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (message.type === "request-autofill-profile") {
    void Promise.all([
      getProfileFromBridge(),
      message.mode === "tailored"
        ? recentJob(tabId).then((job) => {
          if (!job) throw new Error("Open the job posting before using tailored autofill.");
          return getTailoredResumeFromBridge({
            job: {
              company: job.company,
              title: job.title,
              jobUrl: job.jobUrl,
              jobDescription: job.jobDescription,
            },
          });
        })
        : getResumeTemplateFromBridge().then((resume) => ({ resume, source: "master" as const })),
    ]).then(([profile, result]) => {
      sendResponse({
        type: "autofill-profile-response",
        profile: profile ?? null,
        resume: result.resume ?? null,
        resumeSource: result.source,
      });
    }).catch((error) => {
      sendResponse({
        type: "autofill-profile-response",
        profile: null,
        resume: null,
        error: error instanceof Error ? error.message : "Autofill sources are unavailable.",
      });
    });
    return true;
  }

  if (tabId === undefined) return;

  if (message.type === "job-detected") {
    detectedJobByTab.set(tabId, { job: message.job, confidence: message.confidence });
    void rememberRecentJob(tabId, message.job);
  } else if (message.type === "job-cleared") {
    detectedJobByTab.delete(tabId);
  } else if (message.type === "page-snapshot") {
    void postJson<IngestJobResponse>("/job-intelligence/ingest", {
      url: message.snapshot.url,
      snapshot: message.snapshot,
    }).then((result) => {
      if (result.posting) detectedJobByTab.set(tabId, { job: result.posting, confidence: result.confidence });
      // The local content-script detector decides whether a job is present;
      // a stale or uncertain server ingest result must not delete that
      // decision, because the two run concurrently with no happens-before
      // guarantee.
    }).catch(() => {
      // The local browser extraction remains available while the desktop
      // bridge is closed; reconnecting naturally refreshes on the next page.
    });
  }

  sendResponse({ ok: true });
});

chrome.runtime.onMessage.addListener((message: { type: "get-detected-job"; tabId: number }, _sender, sendResponse) => {
  if (message.type === "get-detected-job") {
    sendResponse(detectedJobByTab.get(message.tabId) ?? null);
    return true;
  }
});
