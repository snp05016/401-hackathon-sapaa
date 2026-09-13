export type KeywordCategory =
  | "language"
  | "framework"
  | "database"
  | "cloud"
  | "tool"
  | "methodology"
  | "domain"
  | "qualification"
  | "soft_skill"
  | "other";

export interface Keyword {
  term: string;
  score: number;
  occurrences: number;
  category: KeywordCategory;
}

/**
 * The one normalized job representation shared by ingestion, the extension,
 * matching, and application persistence. `id` is deterministic and currently
 * equals `fingerprint`; consumers must not assume it is a database row id.
 */
export interface JobPosting {
  id: string;
  fingerprint: string;
  contentFingerprint: string | null;

  source: string;
  sourceJobId: string | null;

  company: string;
  title: string;
  location: string | null;
  jobUrl: string;
  jobDescription: string;

  employmentType: string | null;
  requirements: string[];
  keywords: Keyword[];

  postedAt: string | null;
  salaryRange: string | null;
  scrapedAt: string;

  /**
   * Fields below are best-effort. Deterministic extraction (JSON-LD, provider
   * APIs, DOM) fills what it can; anything still null may be completed by one
   * LLM pass over the already-cleaned description. Always nullable.
   */
  workArrangement: "remote" | "hybrid" | "onsite" | null;
  applicationDeadline: string | null;
  startDate: string | null;
  termDuration: string | null;
  responsibilities: string[];
  preferredQualifications: string[];
  education: string | null;
  workAuthorization: string | null;
  clearance: string | null;
}
