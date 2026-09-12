import type { JobPosting } from "@ghostboard/shared";
import type { JobExtractionDraft } from "./types";

const TRACKING_PARAMS = [
  /^utm_/i, /^gh_src$/i, /^fbclid$/i, /^gclid$/i, /^mc_cid$/i, /^mc_eid$/i,
  /^igshid$/i, /^_hsenc$/i, /^_hsmi$/i, /^trk$/i, /^trackingid$/i,
];

export function normalizeWhitespace(value: unknown): string {
  return String(value ?? "").replace(/[\t\u00a0 ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function normalizeInline(value: unknown): string {
  return normalizeWhitespace(value).replace(/\s+/g, " ").trim();
}

/** Conservative URL key adapted from career-ops/url-key.mjs. */
export function normalizeJobUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(String(raw).trim());
  } catch {
    return "";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  const kept = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAMS.some((pattern) => pattern.test(key)))
    .sort(([ak, av], [bk, bv]) => ak.localeCompare(bk) || av.localeCompare(bv));
  url.search = "";
  for (const [key, value] of kept) url.searchParams.append(key, value);
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function normalizeRequirements(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeInline(value);
    const key = normalized.toLowerCase();
    if (normalized.length >= 3 && !seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }
  return result.slice(0, 50);
}

function fnv1a64(value: string): bigint {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index++) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash;
}

export function stableHash(value: string): string {
  return fnv1a64(value).toString(16).padStart(16, "0");
}

function identityText(value: unknown): string {
  return normalizeInline(value).normalize("NFKC").toLocaleLowerCase();
}

function isListingLikeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (!parts.length) return true;
    const last = parts.at(-1)!.toLowerCase();
    return /^(?:jobs?|careers?|search|opportunities|openings|positions|details|view|posting)$/.test(last);
  } catch {
    return true;
  }
}

/** Stable identity: provider id first, specific canonical URL second, fields otherwise. */
export function fingerprintJob(draft: JobExtractionDraft): string {
  const source = identityText(draft.source || "generic");
  const sourceJobId = identityText(draft.sourceJobId);
  if (sourceJobId) return stableHash(`${source}|id|${sourceJobId}`);
  const url = normalizeJobUrl(draft.url ?? "");
  if (url && !isListingLikeUrl(url)) return stableHash(`${source}|url|${url}`);
  return stableHash([
    source,
    url,
    identityText(draft.company),
    identityText(draft.title),
    identityText(draft.location),
  ].join("|"));
}

/** 64-bit SimHash over 3-token shingles, adapted from career-ops/fingerprint-core.mjs. */
export function fingerprintDescription(text: string): string | null {
  const normalized = String(text ?? "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length < 200) return null;
  const tokens = normalized.split(" ");
  if (tokens.length < 3) return null;
  const weights = new Array<number>(64).fill(0);
  for (let index = 0; index <= tokens.length - 3; index++) {
    const hash = fnv1a64(`${tokens[index]} ${tokens[index + 1]} ${tokens[index + 2]}`);
    for (let bit = 0; bit < 64; bit++) {
      weights[bit] += (hash & (1n << BigInt(63 - bit))) === 0n ? -1 : 1;
    }
  }
  let result = 0n;
  for (let bit = 0; bit < 64; bit++) if (weights[bit] > 0) result |= 1n << BigInt(63 - bit);
  return result.toString(16).padStart(16, "0");
}

export function contentFingerprintSimilarity(left: string | null, right: string | null): number {
  if (!left || !right || !/^[0-9a-f]{16}$/.test(left) || !/^[0-9a-f]{16}$/.test(right)) return 0;
  let xor = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let distance = 0;
  while (xor) {
    xor &= xor - 1n;
    distance++;
  }
  return 1 - distance / 64;
}

export function areDuplicateJobs(left: JobPosting, right: JobPosting): boolean {
  if (left.fingerprint === right.fingerprint) return true;
  if (left.sourceJobId && right.sourceJobId && left.source === right.source) {
    return left.sourceJobId.toLowerCase() === right.sourceJobId.toLowerCase();
  }
  const sameCore = identityText(left.company) === identityText(right.company)
    && identityText(left.title) === identityText(right.title)
    && identityText(left.location) === identityText(right.location);
  return sameCore && contentFingerprintSimilarity(left.contentFingerprint, right.contentFingerprint) >= 0.92;
}
