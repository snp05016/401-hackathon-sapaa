import type { JobScraper, ScrapeResult } from "./types";
import { ingestDocument } from "./document";

/** Browser-side facade retained for the extension and adapter compatibility. */
export const genericScraper: JobScraper = {
  name: "generic",
  matches: () => true,
  scrape(url: string, document: Document): ScrapeResult | null {
    const result = ingestDocument(url, document);
    return result.posting ? { posting: result.posting, confidence: result.confidence } : null;
  },
};
