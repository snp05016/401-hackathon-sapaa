import type { LLMProvider } from "@ghostboard/ai";
import { parseBullets, type ResumeBullet } from "./bullets";

/**
 * Per-bullet tailoring. The model never sees or writes the document: it gets
 * numbered bullet prose and returns rewrites, which the caller applies through
 * applyBulletEdits. Layout cannot be damaged because layout is never in play.
 */

export interface BulletProposal {
  id: string;
  /** The bullet as it stands today, for side-by-side review. */
  before: string;
  /** The suggested replacement, as prose. */
  after: string;
  /** One short line on why, shown next to the accept control. */
  rationale: string;
  /**
   * True when `after` contains a capability the original bullet did not state.
   * A flagged proposal is still returned, so the user can see and reject it.
   */
  unsupported: boolean;
}

export interface ProposeBulletsOptions {
  provider?: Pick<LLMProvider, "complete">;
  /** Cap on bullets sent in one call. */
  maxBullets?: number;
}

const MAX_JOB_DESCRIPTION = 12_000;

function buildPrompt(bullets: ResumeBullet[], jobDescription: string): string {
  const numbered = bullets
    .map((bullet, index) => `${index + 1}. [${bullet.section ?? "?"}${bullet.employer ? ` / ${bullet.employer}` : ""}] ${bullet.text}`)
    .join("\n");
  return [
    "Job description:",
    "---",
    jobDescription.slice(0, MAX_JOB_DESCRIPTION),
    "---",
    "Resume bullets:",
    numbered,
    "---",
    "Rewrite only the bullets where the job description suggests a better emphasis of what the bullet ALREADY says.",
    'Return JSON: {"proposals":[{"n":<bullet number>,"after":"<rewritten bullet>","rationale":"<max 12 words>"}]}',
    "Rules:",
    "- Never add a tool, metric, scope, or outcome the original bullet does not state.",
    "- Never change numbers, dates, employers, or titles.",
    "- Keep each rewrite to one sentence, similar length to the original.",
    "- Omit a bullet entirely if it needs no change. Returning an empty list is correct when nothing needs rewriting.",
  ].join("\n");
}

/**
 * Flags a rewrite that imports a *named* capability the original bullet never
 * stated -- a technology, product, or proper noun. Generic verb swaps
 * ("developed" to "designed") are not flagged: they are rephrasing, not new
 * claims, and flagging them trains the user to ignore the warning.
 */
export function flagUnsupported(before: string, after: string): boolean {
  // Trailing sentence punctuation must not make "PostgreSQL." a different word
  // from "PostgreSQL", or a term present in the original reads as newly added.
  const normalize = (word: string) => word.toLowerCase().replace(/[.]+$/, "");
  const known = new Set((before.match(/[A-Za-z0-9+#.]{2,}/g) ?? []).map(normalize));
  // A capitalised word that does not open a sentence, or any token carrying a
  // digit or +/#, reads as a named thing rather than ordinary prose.
  for (const match of after.matchAll(/([.!?]\s+)?\b([A-Za-z][A-Za-z0-9+#.]*)\b/g)) {
    const sentenceInitial = !!match[1] || match.index === 0;
    const word = match[2];
    const named = (/[A-Z]/.test(word.slice(1)) || /^[A-Z]/.test(word)) && !sentenceInitial;
    const technical = /[0-9+#]/.test(word) && /[A-Za-z]/.test(word);
    if (!named && !technical) continue;
    if (known.has(normalize(word))) continue;
    return true;
  }
  return false;
}

function parseProposals(text: string): Array<{ n: number; after: string; rationale?: string }> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(body.slice(start, end + 1)) as { proposals?: unknown };
    return Array.isArray(parsed.proposals) ? parsed.proposals as Array<{ n: number; after: string; rationale?: string }> : [];
  } catch {
    return [];
  }
}

export async function proposeBulletRewrites(
  masterLatex: string,
  jobDescription: string,
  options: ProposeBulletsOptions = {},
): Promise<{ proposals: BulletProposal[]; warnings: string[] }> {
  if (!jobDescription.trim()) throw new Error("A job description is required for tailoring.");
  const provider = options.provider;
  if (!provider) throw new Error("No LLM provider configured for tailoring.");

  const bullets = parseBullets(masterLatex).slice(0, options.maxBullets ?? 40);
  if (!bullets.length) return { proposals: [], warnings: ["No bullets were found in this resume."] };

  const warnings: string[] = [];
  let text: string;
  try {
    const completion = await provider.complete({
      messages: [
        { role: "system", content: "You tailor resume bullets. You never invent capabilities. You reply with JSON only." },
        { role: "user", content: buildPrompt(bullets, jobDescription) },
      ],
      temperature: 0,
      maxTokens: 3000,
      reasoningEffort: "low",
    });
    text = completion.text;
  } catch (error) {
    return { proposals: [], warnings: [`Tailoring failed: ${error instanceof Error ? error.message : String(error)}`] };
  }

  const raw = parseProposals(text);
  if (!raw.length && text.trim()) warnings.push("The model returned no usable proposals.");

  const proposals: BulletProposal[] = [];
  for (const item of raw) {
    const bullet = bullets[Number(item.n) - 1];
    const after = String(item.after ?? "").trim();
    if (!bullet || !after || after === bullet.text) continue;
    proposals.push({
      id: bullet.id,
      before: bullet.text,
      after,
      rationale: String(item.rationale ?? "").trim().slice(0, 120),
      unsupported: flagUnsupported(bullet.text, after),
    });
  }
  return { proposals, warnings };
}
