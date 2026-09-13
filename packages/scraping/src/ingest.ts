import type { IngestJobResponse, JobPageSnapshot } from "@ghostboard/shared";
import { buildCanonicalJob, mergeDrafts } from "./canonical";
import { enrichDraft } from "./enrich";
import { draftFromHtml, draftFromJsonLd, greenhouseCompanyFromPageTitle, withExtractedSections } from "./html";
import { normalizeInline, normalizeJobUrl, stableHash } from "./normalization";
import { detectProvider, extractSourceJobId, fetchProviderDraft } from "./providers";
import type { JobExtractionDraft, JobIngestionCache, JobIngestionInput, JobIngestionOptions } from "./types";

export class MemoryJobIngestionCache implements JobIngestionCache {
  private readonly values = new Map<string, IngestJobResponse>();
  constructor(private readonly maxEntries = 100) {}

  get(key: string): IngestJobResponse | undefined {
    return this.values.get(key);
  }

  set(key: string, value: IngestJobResponse): void {
    this.values.delete(key);
    this.values.set(key, value);
    while (this.values.size > this.maxEntries) this.values.delete(this.values.keys().next().value!);
  }
}

const defaultCache = new MemoryJobIngestionCache();

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

export function validateJobUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return { ok: false, error: "Invalid URL." }; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, error: "Only HTTP(S) job URLs are supported." };
  if (url.username || url.password) return { ok: false, error: "URLs containing credentials are not allowed." };
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || isPrivateIpv4(host)
    || host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return { ok: false, error: "Private or local network URLs are not allowed." };
  }
  return { ok: true, url };
}

function snapshotInput(input: JobIngestionInput): { snapshot?: JobPageSnapshot; html: string; visibleText: string; pageTitle: string; metadata: Record<string, string> } {
  const snapshot = input.snapshot;
  return {
    snapshot,
    html: input.html ?? snapshot?.html ?? "",
    visibleText: input.visibleText ?? snapshot?.visibleText ?? "",
    pageTitle: snapshot?.pageTitle ?? "",
    metadata: snapshot?.metadata ?? {},
  };
}

function snapshotDraft(input: JobIngestionInput): JobExtractionDraft {
  const { snapshot, visibleText, pageTitle, metadata } = snapshotInput(input);
  const provider = detectProvider(input.url);
  const titleParts = pageTitle.split(/\s[-|·]\s/).map(normalizeInline).filter(Boolean);
  return {
    source: provider,
    sourceJobId: metadata.sourceJobId || extractSourceJobId(input.url, provider),
    url: input.url,
    title: metadata.title || metadata["og:title"] || titleParts[0] || null,
    company: metadata.company || metadata["og:site_name"]
      || (provider === "greenhouse" ? greenhouseCompanyFromPageTitle(pageTitle) : null)
      || titleParts.at(-1) || null,
    location: metadata.location || null,
    salaryRange: metadata.salary || null,
    employmentType: metadata.employmentType || null,
    description: [...(snapshot?.selectedContent ?? []), visibleText].filter(Boolean).join("\n\n") || null,
    postedAt: metadata.datePosted || metadata["article:published_time"] || null,
  };
}

async function fetchPageHtml(start: URL, fetcher: typeof globalThis.fetch): Promise<{ html: string; url: string }> {
  let current = start;
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetcher(current.href, {
      method: "GET",
      redirect: "manual",
      headers: { accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`Redirect ${response.status} did not include a location.`);
      const checked = validateJobUrl(new URL(location, current).href);
      if (!checked.ok) throw new Error(checked.error);
      current = checked.url;
      continue;
    }
    if (!response.ok) throw new Error(`Job page returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !/html|xhtml|text\/plain/i.test(contentType)) throw new Error(`Unsupported response type: ${contentType}.`);
    return { html: (await response.text()).slice(0, 2_000_000), url: current.href };
  }
  throw new Error("Too many redirects while fetching job page.");
}

function detection(draft: JobExtractionDraft, html: string, visibleText: string, providerSucceeded: boolean): { outcome: "job" | "not_job" | "uncertain"; confidence: number; evidence: string[] } {
  const evidence: string[] = [];
  let score = 0;
  if (html && draftFromJsonLd(html, draft.url ?? "")) {
    evidence.push("schema.org JobPosting structured data");
    score += 0.55;
  }
  if (draft.source && draft.source !== "generic") {
    evidence.push(`recognized ${draft.source} provider`);
    score += 0.3;
  }
  if (providerSucceeded) {
    evidence.push("provider public API returned the posting");
    score += 0.25;
  }
  if (/\/(?:jobs?|careers?|positions?|opportunities)\b/i.test(draft.url ?? "")) {
    evidence.push("job-like URL path");
    score += 0.1;
  }
  const text = `${draft.description ?? ""}\n${visibleText}`;
  const hasSections = /\b(?:responsibilities|requirements|qualifications|what you(?:'|’)ll do|about the role)\b/i.test(text);
  if (hasSections) {
    evidence.push("job-description sections present");
    score += 0.15;
  }
  const hasApply = /\b(?:apply now|submit application|apply for this job)\b/i.test(text) || /href=["'][^"']*apply/i.test(html);
  if (hasApply) {
    evidence.push("application control or call-to-action present");
    score += 0.12;
  }
  if ((draft.description?.length ?? 0) >= 300 && (hasSections || hasApply)) score += 0.08;
  const confidence = Math.min(1, Number(score.toFixed(2)));
  return { outcome: score >= 0.45 ? "job" : score >= 0.22 ? "uncertain" : "not_job", confidence, evidence };
}

function cacheKey(input: JobIngestionInput): string {
  const { html, visibleText, pageTitle } = snapshotInput(input);
  const material = `${normalizeJobUrl(input.url)}|${pageTitle}|${html ? stableHash(html) : stableHash(visibleText)}`;
  return stableHash(material);
}

/** URL, raw HTML, or extension snapshot → one canonical JobPosting. */
export async function ingestJob(input: JobIngestionInput, options: JobIngestionOptions = {}): Promise<IngestJobResponse> {
  const checked = validateJobUrl(input.url || input.snapshot?.url || "");
  if (!checked.ok) return { outcome: "not_job", confidence: 0, evidence: [], warnings: [checked.error], cached: false };
  const normalizedInput = { ...input, url: checked.url.href };
  const cache = options.cache ?? defaultCache;
  const key = cacheKey(normalizedInput);
  const cached = cache.get(key);
  if (cached) return { ...cached, cached: true };

  const { html: suppliedHtml, visibleText } = snapshotInput(normalizedInput);
  const warnings: string[] = [];
  let html = suppliedHtml;
  let resolvedUrl = checked.url;
  let providerDraft: JobExtractionDraft | null = null;
  let htmlDraft: JobExtractionDraft | null = null;

  if (!html) {
    const fetcher = options.fetch ?? globalThis.fetch;
    if (!fetcher) {
      warnings.push("No fetch implementation is available for URL ingestion.");
    } else {
      try {
        providerDraft = await fetchProviderDraft(checked.url, { fetch: fetcher });
      } catch (error) {
        warnings.push(`Provider API extraction failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (!providerDraft?.company || !providerDraft?.title || !providerDraft?.description) {
        try {
          const page = await fetchPageHtml(checked.url, fetcher);
          html = page.html;
          resolvedUrl = new URL(page.url);
        } catch (error) {
          warnings.push(error instanceof Error ? error.message : String(error));
        }
      }
    }
  }

  if (html) htmlDraft = draftFromHtml(html, resolvedUrl.href, visibleText);
  else if (visibleText || normalizedInput.snapshot) htmlDraft = snapshotDraft(normalizedInput);
  const merged = withExtractedSections(mergeDrafts(providerDraft, htmlDraft ?? snapshotDraft(normalizedInput)));
  // Enrich before canonicalization so the LLM sees deterministic extraction's
  // gaps, and only ever fills them. Cleaned description only -- never raw HTML.
  const draft = options.llm ? await enrichDraft(merged, options.llm, warnings) : merged;
  const requestedDate = options.now?.() ?? new Date(normalizedInput.snapshot?.capturedAt ?? Date.now());
  const capturedAt = Number.isNaN(requestedDate.getTime()) ? new Date() : requestedDate;
  const built = buildCanonicalJob(draft, capturedAt);
  const detected = detection(draft, html, visibleText, providerDraft !== null);
  const outcome = detected.outcome === "job" && !built.posting ? "uncertain" : detected.outcome;
  if (built.posting && outcome !== "job") {
    warnings.push(`A complete posting was extracted but confidence ${detected.confidence} is below the 0.45 threshold, so it was not returned.`);
  }
  const response: IngestJobResponse = {
    outcome,
    confidence: detected.confidence,
    ...(outcome === "job" && built.posting ? { posting: built.posting } : {}),
    evidence: detected.evidence,
    warnings: [...warnings, ...built.warnings],
    cached: false,
  };
  cache.set(key, response);
  if (response.posting) cache.set(`job:${response.posting.fingerprint}`, response);
  return response;
}
