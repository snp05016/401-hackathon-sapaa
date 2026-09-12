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
}
