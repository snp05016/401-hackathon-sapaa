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

function attributeText(html: string, attributePattern: string): string | null {
  const region = new RegExp(
    `<([a-z][\\w-]*)\\b[^>]*(?:id|class|data-testid|data-automation-id|aria-label)=["'][^"']*(?:${attributePattern})[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    "i",
  );
  const match = html.match(region);
  return match ? normalizeInline(htmlToText(match[2])) || null : null;
}

export function greenhouseCompanyFromPageTitle(value: string | null | undefined): string | null {
  const title = normalizeInline(value);
  const match = title.match(/^Job Application for .+\s+at\s+(.+)$/i);
  return normalizeInline(match?.[1]) || null;
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

/** schema.org `jobLocationType`/location text to the three arrangements we track. */
export function workArrangementFrom(...values: unknown[]): "remote" | "hybrid" | "onsite" | null {
  const text = values.map(normalizeInline).join(" ").toLowerCase();
  if (/\bhybrid\b/.test(text)) return "hybrid";
  if (/telecommute|\bremote\b|work from home|distributed/.test(text)) return "remote";
  if (/\bon[- ]?site\b|\bin[- ]?office\b|\bin[- ]person\b/.test(text)) return "onsite";
  return null;
}

function educationFromJsonLd(value: unknown): string | null {
  if (typeof value === "string") return normalizeInline(htmlToText(value)) || null;
  if (Array.isArray(value)) return value.map(educationFromJsonLd).filter(Boolean).join("; ") || null;
  if (!value || typeof value !== "object") return null;
  const node = value as Record<string, unknown>;
  return normalizeInline(node.credentialCategory || node.name || node.description) || null;
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
    workArrangement: workArrangementFrom(node.jobLocationType, employment, node.title),
    applicationDeadline: normalizeInline(node.validThrough) || null,
    startDate: normalizeInline(node.jobStartDate) || null,
    education: educationFromJsonLd(node.educationRequirements),
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

type Section = "required" | "preferred" | "responsibilities";

/**
 * Heading cues that open a bulleted section. Deliberately generous: real
 * postings phrase these a dozen ways ("You may be a good fit if you have...",
 * "What you'll bring"), and a missed heading costs us the whole section.
 */
const SECTION_HEADINGS: Array<[Section, RegExp]> = [
  ["preferred", /^(?:preferred|nice[- ]to[- ]haves?|bonus(?: points)?|pluses|it(?:'|\u2019)s a plus|strong(?:ly preferred)?|additionally,? (?:strong )?candidates|desired|we(?:'|\u2019)d love|you might also)\b/i],
  ["required", /^(?:requirements?|qualifications?|minimum|basic qualifications?|must[- ]haves?|what (?:we(?:(?:'|\u2019)re| are) looking for|you(?:(?:'|\u2019)ll| will)? (?:bring|need|have))|who you are|about you|you (?:may be a good fit|could be a good fit|will be a good fit|should (?:have|apply))|we(?:'|\u2019)re looking for|skills? (?:and experience|required)|experience)\b/i],
  ["responsibilities", /^(?:responsibilities|what you(?:(?:'|\u2019)ll| will)? (?:do|be doing|own|work on)|in this role|the role|your (?:role|impact)|day[- ]to[- ]day|key duties|duties)\b/i],
];

/** Headings that end any bulleted section without opening a new one. */
const SECTION_STOP = /^(?:benefits?|perks?|compensation|salary|pay range|about (?:us|the (?:company|team))|equal (?:opportunity|employment)|how to apply|our (?:values|mission)|location|logistics|deadline|create a job alert|apply for this job)\b/i;

function collectSections(description: string): Record<Section, string[]> {
  const out: Record<Section, string[]> = { required: [], preferred: [], responsibilities: [] };
  let active: Section | null = null;
  for (const raw of description.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:#{1,6}|[-*\u2022])\s*/, "").trim();
    if (!line) continue;
    if (SECTION_STOP.test(line)) {
      active = null;
      continue;
    }
    const heading = SECTION_HEADINGS.find(([, pattern]) => pattern.test(line));
    // A heading is only a heading when it is short; a bullet may quote the word.
    if (heading && line.length <= 120) {
      active = heading[0];
      continue;
    }
    if (active && /^\s*[-*\u2022]/.test(raw) && line.length >= 3 && !out[active].includes(line)) out[active].push(line);
  }
  return out;
}

/** Required qualifications only. Preferred and responsibilities have their own readers. */
export function extractRequirements(description: string): string[] {
  return collectSections(description).required.slice(0, 50);
}

export function extractPreferredQualifications(description: string): string[] {
  return collectSections(description).preferred.slice(0, 50);
}

export function extractResponsibilities(description: string): string[] {
  return collectSections(description).responsibilities.slice(0, 50);
}

/**
 * Fills a draft's bulleted sections from its own description. Run before LLM
 * enrichment so the deterministic splitter always wins over a model guess.
 */
export function withExtractedSections(draft: JobExtractionDraft): JobExtractionDraft {
  const description = String(draft.description ?? "");
  if (!description) return draft;
  const sections = collectSections(description);
  return {
    ...draft,
    requirements: draft.requirements?.length ? draft.requirements : sections.required.slice(0, 50),
    responsibilities: draft.responsibilities?.length ? draft.responsibilities : sections.responsibilities.slice(0, 50),
    preferredQualifications: draft.preferredQualifications?.length ? draft.preferredQualifications : sections.preferred.slice(0, 50),
  };
}

export function draftFromHtml(html: string, url: string, visibleText?: string): JobExtractionDraft {
  const structured = draftFromJsonLd(html, url);
  if (structured) return structured;
  const provider = detectProvider(url);
  const documentTitle = tagText(html, "title");
  const h1 = tagText(html, "h1");
  const ogTitle = metaContent(html, ["og:title", "twitter:title"]);
  const site = metaContent(html, ["og:site_name", "application-name"]);
  const title = ogTitle || h1 || attributeText(html, "job[-_ ]?title|posting[-_ ]?title") || documentTitle?.split(/\s[-|·]\s/)[0] || null;
  const description = candidateDescription(html) || normalizeWhitespace(visibleText);
  return {
    source: provider,
    sourceJobId: extractSourceJobId(url, provider),
    url,
    company: site || attributeText(html, "company|employer|hiring[-_ ]?organization")
      || (provider === "greenhouse" ? greenhouseCompanyFromPageTitle(documentTitle) : null)
      || (documentTitle?.split(/\s[-|·]\s/).at(-1) ?? null),
    title,
    location: metaContent(html, ["job:location", "geo.placename"]) || attributeText(html, "job[-_ ]?location|location"),
    salaryRange: metaContent(html, ["job:salary"]),
    description,
    requirements: extractRequirements(description),
    postedAt: metaContent(html, ["article:published_time", "date"]),
  };
}
