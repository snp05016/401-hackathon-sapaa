import { extractJobKeywords } from "@ghostboard/matching";
import type { JobPosting } from "@ghostboard/shared";
import { htmlToText, extractPreferredQualifications, extractRequirements, extractResponsibilities, workArrangementFrom } from "./html";
import { fingerprintDescription, fingerprintJob, normalizeDate, normalizeInline, normalizeJobUrl, normalizeRequirements } from "./normalization";
import type { JobExtractionDraft } from "./types";

export interface CanonicalBuildResult {
  posting: JobPosting | null;
  warnings: string[];
}

function meaningful(value: unknown): string {
  const normalized = normalizeInline(value);
  return /^(?:unknown|n\/?a|null|undefined|-|—)$/i.test(normalized) ? "" : normalized;
}

export function mergeDrafts(primary: JobExtractionDraft | null, fallback: JobExtractionDraft | null): JobExtractionDraft {
  const first = primary ?? {};
  const second = fallback ?? {};
  const pick = <K extends keyof JobExtractionDraft>(key: K): JobExtractionDraft[K] => first[key] || second[key];
  return {
    source: pick("source"),
    sourceJobId: pick("sourceJobId"),
    url: pick("url"),
    company: pick("company"),
    title: pick("title"),
    location: pick("location"),
    salaryRange: pick("salaryRange"),
    employmentType: pick("employmentType"),
    description: pick("description"),
    requirements: first.requirements?.length ? first.requirements : second.requirements,
    postedAt: pick("postedAt"),
    workArrangement: pick("workArrangement"),
    applicationDeadline: pick("applicationDeadline"),
    startDate: pick("startDate"),
    termDuration: pick("termDuration"),
    responsibilities: first.responsibilities?.length ? first.responsibilities : second.responsibilities,
    preferredQualifications: first.preferredQualifications?.length ? first.preferredQualifications : second.preferredQualifications,
    education: pick("education"),
    workAuthorization: pick("workAuthorization"),
    clearance: pick("clearance"),
  };
}

/**
 * ISO-normalizes only a value that already names a specific calendar day.
 * "June 2026" stays verbatim rather than becoming a fabricated 2026-06-01.
 */
function preciseDateOrVerbatim(value: unknown): string | null {
  const text = meaningful(value);
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? normalizeDate(text) ?? text : text;
}

export function buildCanonicalJob(draft: JobExtractionDraft, capturedAt = new Date()): CanonicalBuildResult {
  const warnings: string[] = [];
  const url = normalizeJobUrl(draft.url ?? "");
  const company = meaningful(draft.company);
  const title = meaningful(draft.title);
  const description = htmlToText(draft.description).slice(0, 50_000);
  if (!url) warnings.push("A valid HTTP(S) job URL was not available.");
  if (!company) warnings.push("Company could not be extracted.");
  if (!title) warnings.push("Job title could not be extracted.");
  if (description.length < 120) warnings.push("Job description is missing or too short to trust.");
  if (!url || !company || !title || description.length < 120) return { posting: null, warnings };

  const requirements = normalizeRequirements(draft.requirements?.length ? draft.requirements : extractRequirements(description));
  const responsibilities = normalizeRequirements(draft.responsibilities?.length ? draft.responsibilities : extractResponsibilities(description));
  const preferredQualifications = normalizeRequirements(
    draft.preferredQualifications?.length ? draft.preferredQualifications : extractPreferredQualifications(description)
  );
  const normalizedDraft: JobExtractionDraft = {
    ...draft,
    url,
    company,
    title,
    location: meaningful(draft.location) || null,
    employmentType: meaningful(draft.employmentType) || null,
  };
  const fingerprint = fingerprintJob(normalizedDraft);
  const keywords = extractJobKeywords(description, { title, requirements });
  const posting: JobPosting = {
    id: fingerprint,
    fingerprint,
    contentFingerprint: fingerprintDescription(description),
    source: meaningful(draft.source) || "generic",
    sourceJobId: meaningful(draft.sourceJobId) || null,
    company,
    title,
    location: meaningful(draft.location) || null,
    jobUrl: url,
    jobDescription: description,
    employmentType: meaningful(draft.employmentType) || null,
    requirements,
    keywords,
    postedAt: normalizeDate(draft.postedAt),
    salaryRange: meaningful(draft.salaryRange) || null,
    scrapedAt: capturedAt.toISOString(),
    workArrangement: draft.workArrangement ?? workArrangementFrom(draft.location, title, draft.employmentType),
    applicationDeadline: preciseDateOrVerbatim(draft.applicationDeadline),
    startDate: preciseDateOrVerbatim(draft.startDate),
    termDuration: meaningful(draft.termDuration) || null,
    responsibilities,
    preferredQualifications,
    education: meaningful(draft.education) || null,
    workAuthorization: meaningful(draft.workAuthorization) || null,
    clearance: meaningful(draft.clearance) || null,
  };
  return { posting, warnings };
}
