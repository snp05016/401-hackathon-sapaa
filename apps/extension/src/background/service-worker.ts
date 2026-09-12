import type { ExtensionMessage } from "../shared/messages";
import type { JobPosting } from "@ghostboard/shared";

// ponytail: in-memory per-tab state, resets on service-worker restart — fine for a hackathon popup
const detectedJobByTab = new Map<number, { job: JobPosting; confidence: number }>();

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return;

  if (message.type === "job-detected") {
    detectedJobByTab.set(tabId, { job: message.job, confidence: message.confidence });
  } else if (message.type === "job-cleared") {
    detectedJobByTab.delete(tabId);
  }

  sendResponse({ ok: true });
});

chrome.runtime.onMessage.addListener((message: { type: "get-detected-job"; tabId: number }, _sender, sendResponse) => {
  if (message.type === "get-detected-job") {
    sendResponse(detectedJobByTab.get(message.tabId) ?? null);
    return true;
  }
});
