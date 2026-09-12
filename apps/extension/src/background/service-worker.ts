import type { ExtensionMessage } from "../shared/messages";
import type { IngestJobResponse, JobPosting } from "@ghostboard/shared";
import { getProfileFromBridge, getResumeTemplateFromBridge, postJson, startBridgeMessageReceiver } from "./bridgeClient";

// ponytail: in-memory per-tab state, resets on service-worker restart — fine for a hackathon popup
const detectedJobByTab = new Map<number, { job: JobPosting; confidence: number }>();

startBridgeMessageReceiver();

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (message.type === "request-autofill-profile") {
    void Promise.all([getProfileFromBridge(), getResumeTemplateFromBridge()]).then(([profile, resume]) => {
      sendResponse({ type: "autofill-profile-response", profile: profile ?? null, resume: resume ?? null });
    }).catch(() => {
      sendResponse({ type: "autofill-profile-response", profile: null, resume: null });
    });
    return true;
  }

  if (tabId === undefined) return;

  if (message.type === "job-detected") {
    detectedJobByTab.set(tabId, { job: message.job, confidence: message.confidence });
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
