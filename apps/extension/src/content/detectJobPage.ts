import { genericScraper, stableHash } from "@ghostboard/scraping";
import type { JobPageSnapshot } from "@ghostboard/shared";
import type { ExtensionMessage } from "../shared/messages";

let lastFingerprint = "";
let lastSnapshotSignature = "";

function pageSnapshot(url: string): JobPageSnapshot {
  const metadata: Record<string, string> = {};
  for (const name of ["og:site_name", "og:title", "article:published_time"]) {
    const element = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
    const value = element?.getAttribute("content")?.trim();
    if (value) metadata[name] = value;
  }
  const selectedContent = [
    document.querySelector('[itemprop="description"]'),
    document.querySelector('[data-automation-id="jobPostingDescription"]'),
    document.querySelector("#jobDescriptionText"),
    document.querySelector(".jobs-description__content"),
    document.querySelector("main"),
  ].filter((element): element is Element => !!element)
    .map((element) => (element as HTMLElement).innerText?.slice(0, 50_000) || "")
    .filter(Boolean)
    .slice(0, 3);
  return {
    url,
    pageTitle: document.title,
    html: document.documentElement.outerHTML.slice(0, 1_500_000),
    visibleText: document.body?.innerText.slice(0, 75_000) ?? "",
    selectedContent,
    metadata,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Lightweight detection heuristic mirroring genericScraper's logic, run
 * against the live `document`. Debounced via a MutationObserver so it
 * doesn't re-run on every DOM tick of a SPA.
 */
export function detectJobOnCurrentPage(): void {
  const url = window.location.href;
  const snapshot = pageSnapshot(url);
  const snapshotSignature = stableHash([
    snapshot.url,
    snapshot.pageTitle,
    snapshot.selectedContent?.join("\n").slice(0, 10_000),
    snapshot.visibleText?.length,
  ].join("|"));
  if (snapshotSignature !== lastSnapshotSignature) {
    lastSnapshotSignature = snapshotSignature;
    const snapshotMessage: ExtensionMessage = { type: "page-snapshot", snapshot };
    chrome.runtime.sendMessage(snapshotMessage);
  }
  const result = genericScraper.scrape(url, document);

  if (!result || result.posting.jobDescription.length < 200) {
    if (lastFingerprint) {
      const message: ExtensionMessage = { type: "job-cleared", url };
      chrome.runtime.sendMessage(message);
      lastFingerprint = "";
    }
    return;
  }

  if (lastFingerprint === result.posting.fingerprint) return;
  lastFingerprint = result.posting.fingerprint;
  const message: ExtensionMessage = {
    type: "job-detected",
    job: result.posting,
    confidence: result.confidence,
    url,
  };
  chrome.runtime.sendMessage(message);
}

export function startDetection(): void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(detectJobOnCurrentPage, 500);
  };

  debounced();
  const observer = new MutationObserver(debounced);
  observer.observe(document.body, { childList: true, subtree: true });
}
