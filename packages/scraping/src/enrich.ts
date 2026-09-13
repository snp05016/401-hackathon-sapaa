import { normalizeInline } from "./normalization";
import type { CompletionLike, JobExtractionDraft } from "./types";

/**
 * Fields an LLM may fill. Everything here is either absent from schema.org
 * JobPosting or routinely omitted by it, so deterministic extraction has no
 * shot. Anything a parser can read is never asked for.
 */
const ASKABLE = [
  "workArrangement",
  "termDuration",
  "startDate",
  "applicationDeadline",
  "education",
  "workAuthorization",
  "clearance",
  "responsibilities",
  "preferredQualifications",
] as const;

type Askable = (typeof ASKABLE)[number];

const DESCRIPTIONS: Record<Askable, string> = {
  workArrangement: 'exactly "remote", "hybrid", or "onsite"',
  termDuration: 'internship/co-op term and length, e.g. "Summer 2026, 12 weeks"',
  startDate: "start date as written on the page",
  applicationDeadline: "application deadline as written on the page",
  education: 'degree requirement, e.g. "BS in Computer Science or equivalent"',
  workAuthorization: 'citizenship or visa/sponsorship requirement, e.g. "US work authorization required; no sponsorship"',
  clearance: 'security clearance requirement, e.g. "Active TS/SCI"',
  responsibilities: "array of the role's duties, each a short string",
  preferredQualifications: "array of preferred/nice-to-have qualifications, each a short string",
};

const SECTION_FIELDS: Askable[] = ["responsibilities", "preferredQualifications"];

function isEmpty(draft: JobExtractionDraft, field: Askable): boolean {
  const value = draft[field];
  return Array.isArray(value) ? value.length === 0 : !normalizeInline(value);
}

/**
 * Bulleted sections are asked for only when the deterministic splitter found
 * nothing at all. If it parsed the page and found no "preferred" section, the
 * page has none -- asking anyway just invites the model to paraphrase the
 * required list back as preferred, which is what it does.
 */
function askableFields(draft: JobExtractionDraft): Askable[] {
  const splitterWorked = !!(draft.requirements?.length || draft.responsibilities?.length || draft.preferredQualifications?.length);
  return ASKABLE.filter((field) => isEmpty(draft, field) && !(splitterWorked && SECTION_FIELDS.includes(field)));
}

/** Pulls the first JSON object out of a reply that may be fenced or prefaced. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(body.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function coerceString(value: unknown): string | null {
  const normalized = normalizeInline(value);
  return !normalized || /^(?:unknown|not specified|n\/?a|null|none)$/i.test(normalized) ? null : normalized.slice(0, 400);
}

function coerceList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\n|;/) : [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = coerceString(item);
    if (!normalized || normalized.length < 3 || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    result.push(normalized);
  }
  return result.slice(0, 25);
}

/**
 * One LLM call over the already-cleaned description, asked only for the fields
 * still empty. Never overwrites a deterministically extracted value, and never
 * fails ingestion: on any error the draft is returned unchanged.
 *
 * ponytail: single call, no chunking. The description is capped at 12k chars
 * (~3k tokens); split it only if postings routinely exceed that.
 */
export async function enrichDraft(
  draft: JobExtractionDraft,
  llm: CompletionLike,
  warnings: string[] = []
): Promise<JobExtractionDraft> {
  const description = normalizeInline(draft.description) ? String(draft.description) : "";
  if (description.length < 200) return draft;
  const missing = askableFields(draft);
  if (!missing.length) return draft;

  const schema = missing.map((field) => `  "${field}": ${DESCRIPTIONS[field]} or null`).join(",\n");
  const prompt = [
    "Job posting text:",
    "---",
    description.slice(0, 12_000),
    "---",
    "Return ONLY a JSON object with exactly these keys:",
    `{\n${schema}\n}`,
    "Use null (or [] for arrays) for anything the text does not state. Never guess or infer beyond the text.",
  ].join("\n");

  let text: string;
  try {
    const response = await llm.complete({
      messages: [
        { role: "system", content: "You extract job-posting facts verbatim. You never invent information. You reply with JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      // Groq's default gpt-oss model spends this budget on reasoning tokens
      // before emitting content; too low truncates the JSON mid-object.
      maxTokens: 3000,
      // Copying stated facts into JSON needs no deliberation: this cuts ~30% of
      // billed tokens and most of the latency with no measured accuracy loss.
      reasoningEffort: "low",
    });
    text = response.text;
  } catch (error) {
    warnings.push(`LLM enrichment failed: ${error instanceof Error ? error.message : String(error)}`);
    return draft;
  }

  const parsed = parseJsonObject(text);
  if (!parsed) {
    warnings.push("LLM enrichment returned no parseable JSON.");
    return draft;
  }

  const enriched: JobExtractionDraft = { ...draft };
  for (const field of missing) {
    if (field === "responsibilities" || field === "preferredQualifications") {
      const known = new Set((draft.requirements ?? []).map((item) => normalizeInline(item).toLowerCase()));
      const list = coerceList(parsed[field]).filter((item) => !known.has(item.toLowerCase()));
      if (list.length) enriched[field] = list;
      continue;
    }
    if (field === "workArrangement") {
      const value = coerceString(parsed[field])?.toLowerCase();
      if (value === "remote" || value === "hybrid" || value === "onsite") enriched.workArrangement = value;
      continue;
    }
    const value = coerceString(parsed[field]);
    if (value) enriched[field] = value;
  }
  return enriched;
}
