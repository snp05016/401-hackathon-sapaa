import type { IngestJobResponse, JobPageSnapshot, JobPosting } from "@ghostboard/shared";

export interface ScrapeResult {
  posting: JobPosting;
  confidence: number;
}

export interface JobScraper {
  name: string;
  matches(url: string, document: Document): boolean;
  scrape(url: string, document: Document): ScrapeResult | null;
}

export type JobProviderName =
  | "greenhouse"
  | "lever"
  | "workday"
  | "ashby"
  | "linkedin"
  | "indeed"
  | "generic";

export interface JobExtractionDraft {
  source?: JobProviderName | string;
  sourceJobId?: string | null;
  url?: string;
  company?: string | null;
  title?: string | null;
  location?: string | null;
  salaryRange?: string | null;
  employmentType?: string | null;
  description?: string | null;
  requirements?: string[];
  postedAt?: string | null;
}

export interface JobIngestionInput {
  url: string;
  html?: string;
  visibleText?: string;
  snapshot?: JobPageSnapshot;
}

export interface JobIngestionOptions {
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  cache?: JobIngestionCache;
}

export interface JobIngestionCache {
  get(key: string): IngestJobResponse | undefined;
  set(key: string, value: IngestJobResponse): void;
}

export interface ProviderFetchContext {
  fetch: typeof globalThis.fetch;
}

export interface JobProvider {
  name: JobProviderName;
  matches(url: URL): boolean;
  sourceJobId(url: URL): string | null;
  fetch?(url: URL, context: ProviderFetchContext): Promise<JobExtractionDraft | null>;
}
