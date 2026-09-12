import type { JobPosting, JobSimilarityResult, Keyword } from "@ghostboard/shared";
import { extractJobKeywords } from "./keywords";

const STOP_WORDS = new Set([
  "and", "the", "for", "with", "from", "that", "this", "have", "will", "you", "your", "our",
  "are", "not", "to", "of", "in", "on", "or", "a", "an", "as", "at", "be", "we", "is", "it",
  "job", "role", "team", "work", "company", "candidate", "experience", "years",
]);

export function tokenize(text: string): string[] {
  return String(text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .match(/[\p{L}\p{N}+#./-]+/gu)
    ?.map((token) => token.replace(/^[./-]+|[./-]+$/g, ""))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token)) ?? [];
}

function weightedJaccard(left: Map<string, number>, right: Map<string, number>): number {
  const keys = new Set([...left.keys(), ...right.keys()]);
  if (!keys.size) return 0;
  let intersection = 0;
  let union = 0;
  for (const key of keys) {
    intersection += Math.min(left.get(key) ?? 0, right.get(key) ?? 0);
    union += Math.max(left.get(key) ?? 0, right.get(key) ?? 0);
  }
  return union ? intersection / union : 0;
}

function termFrequency(text: string): Map<string, number> {
  const tokens = tokenize(text);
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  const total = tokens.length || 1;
  for (const [token, count] of counts) counts.set(token, count / total);
  return counts;
}

function keywordMap(keywords: Keyword[]): Map<string, number> {
  return new Map(keywords.map((keyword) => [keyword.term.toLowerCase(), keyword.score]));
}

function keywordSet(job: JobPosting): Keyword[] {
  return job.keywords.length
    ? job.keywords
    : extractJobKeywords(job.jobDescription, { title: job.title, requirements: job.requirements });
}

type Seniority = "intern" | "junior" | "mid" | "senior" | "staff" | "unknown";

function seniority(text: string): Seniority {
  const normalized = ` ${text.toLowerCase()} `;
  const levels: Array<[Seniority, RegExp]> = [
    ["intern", /\b(?:intern|internship|co[- ]?op|student)\b/],
    ["junior", /\b(?:junior|entry[- ]level|new grad|graduate)\b/],
    ["mid", /\b(?:mid|mid[- ]level|intermediate)\b/],
    ["staff", /\b(?:staff|principal|distinguished)\b/],
    ["senior", /\b(?:senior|sr\.?|lead)\b/],
  ];
  const found = levels.filter(([, pattern]) => pattern.test(normalized)).map(([level]) => level);
  return found.length === 1 ? found[0] : "unknown";
}

type EmploymentType = "full-time" | "part-time" | "contract" | "temporary" | "internship" | "volunteer" | "unknown";

function normalizedEmploymentType(value: string | null): EmploymentType {
  if (!value) return "unknown";
  const normalized = value.toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ").trim();
  const types: Array<[EmploymentType, RegExp]> = [
    ["full-time", /\bfull[- ]?time\b/],
    ["part-time", /\bpart[- ]?time\b/],
    ["contract", /\b(?:contract|contractor|freelance)\b/],
    ["temporary", /\b(?:temporary|temp|seasonal)\b/],
    ["internship", /\b(?:internship|intern|co[- ]?op)\b/],
    ["volunteer", /\bvolunteer\b/],
  ];
  const found = types.filter(([, pattern]) => pattern.test(normalized)).map(([type]) => type);
  return found.length === 1 ? found[0] : "unknown";
}

function compatibilityScore<T extends string>(left: T, right: T, unknown: T): number {
  if (left === unknown || right === unknown) return 0.5;
  return left === right ? 1 : 0;
}

function locationScore(left: string | null, right: string | null): number {
  if (!left || !right) return 0.5;
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  if ([...a].some((token) => b.has(token))) return 1;
  if (a.has("remote") && b.has("remote")) return 1;
  return 0;
}

/** Deterministic, explainable similarity over title, skills, body, location, role level, and employment type. */
export function scoreJobSimilarity(target: JobPosting, candidate: JobPosting): JobSimilarityResult {
  const targetKeywords = keywordSet(target);
  const candidateKeywords = keywordSet(candidate);
  const targetKeywordMap = keywordMap(targetKeywords);
  const candidateKeywordMap = keywordMap(candidateKeywords);
  const sharedKeywords = targetKeywords
    .filter((keyword) => candidateKeywordMap.has(keyword.term.toLowerCase()))
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
    .map((keyword) => keyword.term);

  const title = weightedJaccard(termFrequency(target.title), termFrequency(candidate.title));
  const skills = weightedJaccard(targetKeywordMap, candidateKeywordMap);
  const body = weightedJaccard(termFrequency(target.jobDescription), termFrequency(candidate.jobDescription));
  const location = locationScore(target.location, candidate.location);
  const targetSeniority = seniority(target.title);
  const candidateSeniority = seniority(candidate.title);
  const level = compatibilityScore(targetSeniority, candidateSeniority, "unknown");
  const targetEmploymentType = normalizedEmploymentType(target.employmentType);
  const candidateEmploymentType = normalizedEmploymentType(candidate.employmentType);
  const employment = compatibilityScore(targetEmploymentType, candidateEmploymentType, "unknown");
  const score = Number((
    title * 0.38
    + skills * 0.34
    + body * 0.18
    + location * 0.05
    + level * 0.025
    + employment * 0.025
  ).toFixed(3));

  const reasons: string[] = [];
  if (title >= 0.5) reasons.push("Strong title overlap");
  if (sharedKeywords.length) reasons.push(`Shared: ${sharedKeywords.slice(0, 8).join(", ")}`);
  if (level === 1 && targetSeniority !== "unknown") reasons.push(`Both ${targetSeniority}-level roles`);
  if (employment === 1 && targetEmploymentType !== "unknown") reasons.push(`Both ${targetEmploymentType} roles`);
  if (location === 1 && target.location && candidate.location) reasons.push("Compatible location");
  if (!reasons.length) reasons.push("Limited deterministic overlap");

  return {
    jobId: target.id,
    similarJobId: candidate.id,
    score,
    sharedKeywords,
    reasons,
  };
}

export function calculateJobSimilarity(target: JobPosting, candidates: JobPosting[]): JobSimilarityResult[] {
  return candidates
    .filter((candidate) => candidate.id !== target.id)
    .map((candidate) => scoreJobSimilarity(target, candidate))
    .sort((a, b) => b.score - a.score || a.similarJobId.localeCompare(b.similarJobId));
}
