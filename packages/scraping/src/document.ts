import type { IngestJobResponse } from "@ghostboard/shared";
import { buildCanonicalJob, mergeDrafts } from "./canonical";
import { draftFromJsonLd, extractRequirements, greenhouseCompanyFromPageTitle } from "./html";
import { detectProvider, extractSourceJobId } from "./providers";
import { normalizeInline, normalizeWhitespace } from "./normalization";
import type { JobExtractionDraft } from "./types";

const DESCRIPTION_SELECTORS: Record<string, string[]> = {
  greenhouse: ["#content", ".job__description", ".job-post-content"],
  lever: [".posting-page .content", ".posting-page"],
  workday: ['[data-automation-id="jobPostingDescription"]', '[data-automation-id="jobPostingPage"]'],
  ashby: ['[data-testid="job-posting-description"]', ".ashby-job-posting-brief"],
  linkedin: [".jobs-description__content", ".show-more-less-html__markup"],
  indeed: ["#jobDescriptionText"],
  generic: ["[itemprop='description']", "#job-description", ".job-description", ".jobDescription", "main", "article"],
};

function firstText(document: Document, selectors: string[]): string | null {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = normalizeInline(element?.textContent);
    if (text) return text;
  }
  return null;
}

/** Strips a trailing " | SiteName" (or " - "/" · " separated) segment from a raw <title>. */
function titleWithoutSiteSuffix(rawTitle: string): string | null {
  const parts = rawTitle.split(/\s[-|·]\s/).map(normalizeInline).filter(Boolean);
  return parts[0] || null;
}

function meta(document: Document, names: string[]): string | null {
  for (const name of names) {
    const element = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
    const value = normalizeInline(element?.getAttribute("content"));
    if (value) return value;
  }
  return null;
}

function descriptionText(document: Document, provider: string): string {
  const selectors = [...(DESCRIPTION_SELECTORS[provider] ?? []), ...DESCRIPTION_SELECTORS.generic];
  for (const selector of selectors) {
    const source = document.querySelector(selector);
    if (!source) continue;
    const clone = source.cloneNode(true) as Element;
    clone.querySelectorAll("script, style, nav, header, footer, aside, form, noscript, .cookie, .related-jobs, .recommended-jobs").forEach((element) => element.remove());
    const text = normalizeWhitespace((clone as HTMLElement).innerText || clone.textContent);
    if (text.length >= 120) return text.slice(0, 50_000);
  }
  return "";
}

export function draftFromDocument(url: string, document: Document): { draft: JobExtractionDraft; evidence: string[] } {
  const html = document.documentElement?.outerHTML ?? "";
  const structured = draftFromJsonLd(html, url);
  const provider = detectProvider(url);
  const description = descriptionText(document, provider);
  const generic: JobExtractionDraft = {
    source: provider,
    sourceJobId: extractSourceJobId(url, provider),
    url,
    title: firstText(document, ["h1", '[data-automation-id="jobPostingHeader"]']) || meta(document, ["og:title", "twitter:title"]) || titleWithoutSiteSuffix(document.title),
    company: firstText(document, ["[itemprop='hiringOrganization']", ".company-name", '[data-automation-id="company"]'])
      || meta(document, ["og:site_name", "application-name"])
      || (provider === "greenhouse" ? greenhouseCompanyFromPageTitle(document.title) : null),
    location: firstText(document, ["[itemprop='jobLocation']", ".job-location", ".job__location", '[data-automation-id="locations"]', '[data-testid="job-location"]'])
      || (provider === "greenhouse" ? meta(document, ["og:description"]) : null),
    salaryRange: firstText(document, ["[itemprop='baseSalary']", ".salary", '[data-testid="job-salary"]']),
    employmentType: firstText(document, ["[itemprop='employmentType']", ".employment-type"]),
    description,
    requirements: extractRequirements(description),
    postedAt: meta(document, ["article:published_time", "date"]),
  };
  const evidence: string[] = [];
  if (structured) evidence.push("schema.org JobPosting structured data");
  if (provider !== "generic") evidence.push(`recognized ${provider} job URL`);
  if (document.querySelector('a[href*="apply" i], button[id*="apply" i], button[class*="apply" i]')) evidence.push("application control present");
  if (description.length >= 200) evidence.push("substantial job-description content");
  return { draft: mergeDrafts(structured, generic), evidence };
}

export function ingestDocument(url: string, document: Document, capturedAt = new Date()): IngestJobResponse {
  const { draft, evidence } = draftFromDocument(url, document);
  const built = buildCanonicalJob(draft, capturedAt);
  const structured = evidence.some((item) => item.startsWith("schema.org"));
  const provider = evidence.some((item) => item.startsWith("recognized"));
  const apply = evidence.includes("application control present");
  const substantial = evidence.includes("substantial job-description content");
  const sections = /\b(?:responsibilities|requirements|qualifications|what you(?:'|’)ll do|about the role)\b/i.test(draft.description ?? "");
  if (sections) evidence.push("job-description sections present");
  const path = /\/(?:jobs?|careers?|positions?|opportunities)\b/i.test(url);
  if (path) evidence.push("job-like URL path");
  const confidence = Math.min(1,
    (structured ? 0.55 : 0) + (provider ? 0.2 : 0) + (apply ? 0.15 : 0)
    + (substantial ? 0.1 : 0) + (sections ? 0.15 : 0) + (path ? 0.1 : 0));
  const outcome = confidence >= 0.45 && built.posting ? "job" : confidence >= 0.2 ? "uncertain" : "not_job";
  return {
    outcome,
    confidence: Number(confidence.toFixed(2)),
    ...(outcome === "job" && built.posting ? { posting: built.posting } : {}),
    evidence,
    warnings: built.warnings,
    cached: false,
  };
}
