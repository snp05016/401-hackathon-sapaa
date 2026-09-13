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

/**
 * The best-effort half of a posting: absent from schema.org JobPosting or
 * routinely omitted by it, so any of these may be null. Stored as one JSON
 * blob on the application row rather than nine sparse columns.
 */
export type JobDetails = Pick<
  JobPosting,
  | "workArrangement"
  | "applicationDeadline"
  | "startDate"
  | "termDuration"
  | "responsibilities"
  | "preferredQualifications"
  | "education"
  | "workAuthorization"
  | "clearance"
>;

export const JOB_DETAIL_KEYS = [
  "workArrangement", "applicationDeadline", "startDate", "termDuration",
  "responsibilities", "preferredQualifications", "education", "workAuthorization", "clearance",
] as const satisfies readonly (keyof JobDetails)[];

/** Narrows a posting to its best-effort fields, or null when it states none. */
export function jobDetailsOf(posting: JobDetails): JobDetails | null {
  const details = {
    workArrangement: posting.workArrangement ?? null,
    applicationDeadline: posting.applicationDeadline ?? null,
    startDate: posting.startDate ?? null,
    termDuration: posting.termDuration ?? null,
    responsibilities: posting.responsibilities ?? [],
    preferredQualifications: posting.preferredQualifications ?? [],
    education: posting.education ?? null,
    workAuthorization: posting.workAuthorization ?? null,
    clearance: posting.clearance ?? null,
  };
  const empty = JOB_DETAIL_KEYS.every((key) => {
    const value = details[key];
    return Array.isArray(value) ? value.length === 0 : value === null;
  });
  return empty ? null : details;
}

/**
 * The handful of detail fields worth showing on a dense card, in priority
 * order, already formatted. Long free-text fields (education, responsibilities)
 * are deliberately excluded -- they belong on a detail view, not a card.
 */
export function jobDetailBadges(details: JobDetails | null | undefined, limit = 3): string[] {
  if (!details) return [];
  const badges: string[] = [];
  if (details.workArrangement) badges.push(details.workArrangement);
  if (details.termDuration) badges.push(details.termDuration);
  if (details.clearance) badges.push(details.clearance);
  if (details.startDate) badges.push(`starts ${details.startDate}`);
  if (details.workAuthorization) badges.push(details.workAuthorization);
  return badges.map((badge) => (badge.length > 42 ? `${badge.slice(0, 41)}…` : badge)).slice(0, limit);
}

/**
 * A posting deadline as a local calendar date, or null. A deadline may be a
 * full ISO timestamp or free text ("until filled"); only the former converts,
 * so free text never becomes a fabricated date.
 */
export function calendarDateOrNull(value: string | null | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}
