import type { JobExtractionDraft } from "./types";
import { detectProvider, extractSourceJobId } from "./providers";
import { normalizeInline, normalizeWhitespace } from "./normalization";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", bull: "•", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", copy: "©", reg: "®", trade: "™",
};

function isSafeCodePoint(value: number): boolean {
  return value === 9 || value === 10 || value === 13
    || (value >= 0x20 && value <= 0xd7ff)
    || (value >= 0xe000 && value <= 0xfffd)
    || (value >= 0x10000 && value <= 0x10ffff);
}

export function decodeHtmlEntities(value: string): string {
  return String(value ?? "").replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith("#")) {
      const hex = body[1]?.toLowerCase() === "x";
      const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return isSafeCodePoint(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

const REMOVE_BLOCKS = /<(script|style|nav|header|footer|aside|noscript|svg|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const BLOCK_END = /<\/(p|div|section|article|main|ul|ol|h[1-6]|tr|table|blockquote)\s*>/gi;

/** HTML to compact plain text while retaining headings, paragraphs, and bullets. */
export function htmlToText(html: unknown): string {
  if (typeof html !== "string" || !html) return "";
  const firstPass = decodeHtmlEntities(html)
    .replace(REMOVE_BLOCKS, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(BLOCK_END, "\n")
    .replace(/<(?:img|input)\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return normalizeWhitespace(decodeHtmlEntities(firstPass));
}

function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return result;
}

function metaContent(html: string, names: string[]): string | null {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (wanted.has((attrs.property ?? attrs.name ?? "").toLowerCase()) && attrs.content) return normalizeInline(attrs.content);
  }
  return null;
}

function tagText(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? normalizeInline(htmlToText(match[1])) || null : null;
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [record, ...flattenJsonLd(record["@graph"])];
}

export function extractJsonLd(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  for (const match of String(html).matchAll(/<script\b[^>]*(?<![\w-])type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      nodes.push(...flattenJsonLd(JSON.parse(decodeHtmlEntities(match[1].trim()))));
    } catch {
      // A malformed unrelated JSON-LD block must not poison useful page HTML.
    }
  }
  return nodes;
}

function hasJobPostingType(node: Record<string, unknown>): boolean {
  const type = node["@type"];
  return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
}

function locationFromJsonLd(node: Record<string, unknown>): string | null {
  const rawLocations = Array.isArray(node.jobLocation) ? node.jobLocation : node.jobLocation ? [node.jobLocation] : [];
  const locations: string[] = [];
  for (const raw of rawLocations) {
    if (!raw || typeof raw !== "object") continue;
    const place = raw as Record<string, unknown>;
    const address = place.address && typeof place.address === "object" ? place.address as Record<string, unknown> : {};
    const parts = [address.streetAddress, address.addressLocality, address.addressRegion, address.addressCountry]
      .map(normalizeInline).filter(Boolean);
    const value = normalizeInline(place.name) || parts.join(", ");
    if (value && !locations.some((item) => item.toLowerCase() === value.toLowerCase())) locations.push(value);
  }
  const remote = normalizeInline(node.jobLocationType).toLowerCase().includes("telecommute") ? "Remote" : "";
  if (remote && !locations.some((item) => /remote/i.test(item))) locations.push(remote);
  return locations.join(" · ") || null;
}

function salaryFromJsonLd(value: unknown): string | null {
  if (typeof value === "string") return normalizeInline(value) || null;
  if (!value || typeof value !== "object") return null;
  const salary = value as Record<string, unknown>;
  const currency = normalizeInline(salary.currency);
  const nested = salary.value && typeof salary.value === "object" ? salary.value as Record<string, unknown> : salary;
  const min = Number(nested.minValue);
  const max = Number(nested.maxValue);
  const exact = Number(nested.value);
  const unit = normalizeInline(nested.unitText || salary.unitText).toUpperCase();
  const suffix = unit ? ` / ${unit.toLowerCase()}` : "";
  if (Number.isFinite(min) || Number.isFinite(max)) {
    const low = Number.isFinite(min) ? min : max;
    const high = Number.isFinite(max) ? max : min;
    return `${currency ? `${currency} ` : ""}${low.toLocaleString("en-US")}–${high.toLocaleString("en-US")}${suffix}`;
  }
  if (Number.isFinite(exact)) return `${currency ? `${currency} ` : ""}${exact.toLocaleString("en-US")}${suffix}`;
  return null;
}

function identifierFromJsonLd(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") return normalizeInline(value) || null;
  if (!value || typeof value !== "object") return null;
  const id = value as Record<string, unknown>;
  return normalizeInline(id.value || id.name) || null;
}

export function draftFromJsonLd(html: string, url: string): JobExtractionDraft | null {
  const node = extractJsonLd(html).find(hasJobPostingType);
  if (!node) return null;
  const organization = node.hiringOrganization && typeof node.hiringOrganization === "object"
    ? node.hiringOrganization as Record<string, unknown>
    : {};
  const provider = detectProvider(url);
  const employment = Array.isArray(node.employmentType) ? node.employmentType.join(", ") : node.employmentType;
  return {
    source: provider,
    sourceJobId: identifierFromJsonLd(node.identifier) || extractSourceJobId(url, provider),
    url: normalizeInline(node.url) || url,
    company: normalizeInline(organization.name) || null,
    title: normalizeInline(node.title) || null,
    location: locationFromJsonLd(node),
    salaryRange: salaryFromJsonLd(node.baseSalary || node.estimatedSalary),
    employmentType: normalizeInline(employment) || null,
    description: htmlToText(node.description),
    postedAt: normalizeInline(node.datePosted) || null,
  };
}

function candidateDescription(html: string): string {
  const candidates: string[] = [];
  const selectorWords = "job[-_ ]?description|job[-_ ]?details|posting[-_ ]?description|description|requirements";
  const region = new RegExp(`<([a-z][\\w-]*)\\b[^>]*(?:id|class)=["'][^"']*(?:${selectorWords})[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`, "gi");
  for (const match of html.matchAll(region)) {
    const text = htmlToText(match[2]);
    if (text.length >= 120) candidates.push(text);
  }
  for (const tag of ["main", "article"]) {
    const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    const text = match ? htmlToText(match[1]) : "";
    if (text.length >= 120) candidates.push(text);
  }
  if (!candidates.length) candidates.push(htmlToText(html));
  return candidates.sort((a, b) => b.length - a.length)[0].slice(0, 50_000);
}

export function extractRequirements(description: string): string[] {
  const results: string[] = [];
  let active = false;
  const start = /^(?:requirements?|qualifications?|must[- ]haves?|preferred|nice[- ]to[- ]haves?|what (?:we(?:'|’)re looking for|you(?:'|’)ll bring)|who you are|about you)\b/i;
  const stop = /^(?:responsibilities|what you(?:'|’)ll do|benefits?|perks?|compensation|salary|about (?:us|the company)|equal opportunity)\b/i;
  for (const raw of description.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:#{1,6}|[-*•])\s*/, "").trim();
    if (stop.test(line)) active = false;
    if (start.test(line)) {
      active = true;
      continue;
    }
    if (active && /^\s*[-*•]/.test(raw) && line.length >= 3) results.push(line);
  }
  return [...new Set(results)].slice(0, 50);
}

export function draftFromHtml(html: string, url: string, visibleText?: string): JobExtractionDraft {
  const structured = draftFromJsonLd(html, url);
  if (structured) return structured;
  const provider = detectProvider(url);
  const documentTitle = tagText(html, "title");
  const h1 = tagText(html, "h1");
  const ogTitle = metaContent(html, ["og:title", "twitter:title"]);
  const site = metaContent(html, ["og:site_name", "application-name"]);
  const title = ogTitle || h1 || documentTitle;
  const description = candidateDescription(html) || normalizeWhitespace(visibleText);
  return {
    source: provider,
    sourceJobId: extractSourceJobId(url, provider),
    url,
    company: site || (documentTitle?.split(/\s[-|·]\s/).at(-1) ?? null),
    title,
    location: metaContent(html, ["job:location", "geo.placename"]),
    salaryRange: metaContent(html, ["job:salary"]),
    description,
    requirements: extractRequirements(description),
    postedAt: metaContent(html, ["article:published_time", "date"]),
  };
}
