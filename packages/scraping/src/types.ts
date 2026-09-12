import type { JobPosting } from "@ghostboard/shared";

export interface ScrapeResult {
  posting: JobPosting;
  confidence: number;
}

export interface JobScraper {
  name: string;
  matches(url: string, document: Document): boolean;
  scrape(url: string, document: Document): ScrapeResult | null;
}
