import { genericScraper } from "@ghostboard/scraping";
import type { ExtensionMessage } from "../shared/messages";

let lastUrl = "";

/**
 * Lightweight detection heuristic mirroring genericScraper's logic, run
 * against the live `document`. Debounced via a MutationObserver so it
 * doesn't re-run on every DOM tick of a SPA.
 */
export function detectJobOnCurrentPage(): void {
  const url = window.location.href;
  const result = genericScraper.scrape(url, document);

  if (!result || result.posting.jobDescription.length < 200) {
    if (lastUrl) {
      const message: ExtensionMessage = { type: "job-cleared", url };
      chrome.runtime.sendMessage(message);
      lastUrl = "";
    }
    return;
  }

  lastUrl = url;
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
