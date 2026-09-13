import type { ExperienceEntry } from "@ghostboard/shared";
import type { ParsedExperienceEntry } from "./parseMasterLatex";
import { applyBulletDocument, decodeBulletText, parseBulletDocument, type BulletItem } from "./bulletDocument";

const GENERIC_HEADINGS = new Set([
  "experience", "work experience", "employment", "projects", "project experience",
  "resume bank", "experience bank", "additional experience", "accomplishments",
]);

function cleanLine(value: string): string {
  return value
    .replace(/^\s{0,3}(?:[-*+•]\s+|\d+[.)]\s+)/, "")
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/\*\*|__|`/g, "")
    .trim();
}

function splitHeading(value: string): { role: string; employer: string } {
  const heading = cleanLine(value).replace(/\s+\([^)]*(?:19|20)\d{2}[^)]*\)\s*$/, "").trim();
  for (const separator of [/\s+at\s+/i, /\s+\|\s+/, /\s+[—–]\s+/, /\s+-\s+/]) {
    const parts = heading.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) return { role: parts[0].slice(0, 200), employer: parts.slice(1).join(" ").slice(0, 200) };
  }
  return { role: heading.slice(0, 200), employer: "Resume bank" };
}

function field(line: string, label: string): string | null {
  const match = cleanLine(line).match(new RegExp(`^${label}\\s*:\\s*(.+)$`, "i"));
  return match?.[1]?.trim() ?? null;
}

function parseLooseDate(value: string | null): { startDate: string | null; endDate: string | null } {
  if (!value) return { startDate: null, endDate: null };
  const parts = value.split(/\s+(?:to|[-–—])\s+/i).map((part) => part.trim());
  const asDate = (part: string | undefined, isEnd: boolean): string | null => {
    if (!part || /^(present|current|now)$/i.test(part)) return null;
    const iso = part.match(/^((?:19|20)\d{2})(?:[-/]([01]?\d)(?:[-/]([0-3]?\d))?)?$/);
    if (iso) return `${iso[1]}-${(iso[2] ?? (isEnd ? "12" : "01")).padStart(2, "0")}-${(iso[3] ?? "01").padStart(2, "0")}`;
    const month = part.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+((?:19|20)\d{2})$/i);
    if (!month) return null;
    const monthNumber = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(month[1].slice(0, 3).toLowerCase()) + 1;
    return `${month[2]}-${String(monthNumber).padStart(2, "0")}-01`;
  };
  return { startDate: asDate(parts[0], false), endDate: asDate(parts[1], true) };
}

interface BankBlock {
  heading: string;
  lines: string[];
}

function blocksFromText(text: string): BankBlock[] {
  const normalized = text.replace(/^```(?:markdown|md|text|txt)?\s*$/gim, "").replace(/\r\n?/g, "\n");
  const blocks: BankBlock[] = [];
  let current: BankBlock = { heading: "", lines: [] };
  const push = () => {
    if (current.heading || current.lines.some((line) => line.trim())) blocks.push(current);
    current = { heading: "", lines: [] };
  };

  for (const rawLine of normalized.split("\n")) {
    const markdownHeading = rawLine.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    const labelledStart = /^(?:role|title|position)\s*:/i.test(cleanLine(rawLine));
    if (markdownHeading && !GENERIC_HEADINGS.has(cleanLine(markdownHeading[1]).toLowerCase())) {
      push();
      current.heading = markdownHeading[1];
      continue;
    }
    if (labelledStart && current.lines.some((line) => /^(?:role|title|position)\s*:/i.test(cleanLine(line)))) push();
    current.lines.push(rawLine);
  }
  push();

  if (blocks.length <= 1) {
    const paragraphBlocks = normalized.split(/\n\s*\n/).filter((paragraph) => paragraph.trim());
    if (paragraphBlocks.length > 1) {
      return paragraphBlocks.map((paragraph) => {
        const lines = paragraph.split("\n");
        const first = lines.findIndex((line) => line.trim());
        const possibleHeading = first >= 0 && !/^\s{0,3}(?:[-*+•]\s+|\d+[.)]\s+|(?:role|title|position|employer|company|organization|skills|technologies|tools|dates?|period)\s*:)/i.test(lines[first])
          ? cleanLine(lines[first])
          : "";
        return { heading: possibleHeading, lines: possibleHeading ? lines.filter((_, index) => index !== first) : lines };
      });
    }
  }
  if (blocks.length === 1 && !blocks[0].heading) {
    const first = blocks[0].lines.findIndex((line) => line.trim());
    if (first >= 0 && !/^\s{0,3}(?:[-*+•]\s+|\d+[.)]\s+|(?:role|title|position|employer|company|organization|skills|technologies|tools|dates?|period)\s*:)/i.test(blocks[0].lines[first])) {
      blocks[0].heading = cleanLine(blocks[0].lines[first]);
      blocks[0].lines.splice(first, 1);
    }
  }
  return blocks;
}

/** Parse a human-readable Markdown or plain-text evidence bank without using AI. */
export function parseExperienceBankText(text: string, sourceName = "Imported bank"): ParsedExperienceEntry[] {
  if (!text.trim()) return [];
  const entries: ParsedExperienceEntry[] = [];
  for (const block of blocksFromText(text)) {
    const roleValue = block.lines.map((line) => field(line, "(?:role|title|position)")).find(Boolean) ?? null;
    const employerValue = block.lines.map((line) => field(line, "(?:employer|company|organization)")).find(Boolean) ?? null;
    const skillsValue = block.lines.map((line) => field(line, "(?:skills|technologies|tools)")).find(Boolean) ?? null;
    const datesValue = block.lines.map((line) => field(line, "(?:dates?|period)")).find(Boolean) ?? null;
    const inferred = splitHeading(block.heading || roleValue || sourceName.replace(/\.(?:md|markdown|txt)$/i, ""));
    const bullets = block.lines
      .filter((line) => /^\s{0,3}(?:[-*+•]\s+|\d+[.)]\s+)/.test(line))
      .map(cleanLine)
      .filter((bullet) => bullet && !/^(?:role|title|position|employer|company|organization|skills|technologies|tools|dates?|period)\s*:/i.test(bullet))
      .map((bullet) => bullet.slice(0, 1000));
    if (bullets.length === 0) continue;
    const dates = parseLooseDate(datesValue);
    entries.push({
      role: (roleValue ?? inferred.role).slice(0, 200),
      employer: (employerValue ?? inferred.employer).slice(0, 200),
      ...dates,
      bullets: [...new Set(bullets)].slice(0, 100),
      skills: skillsValue?.split(/[,;|]/).map((skill) => skill.trim()).filter(Boolean).slice(0, 100) ?? [],
      source: "experience",
    });
    if (entries.length >= 100) break;
  }
  return entries;
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "is", "it", "of", "on", "or", "our", "that", "the", "their", "this", "to", "using", "was", "we", "will", "with", "you", "your",
]);

function tokens(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").split(/\s+/).filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function compatibleBulletListIndexes(latex: string, candidate: Pick<RankedExperienceBullet, "role" | "employer">): number[] {
  const genericEmployerTerms = new Set(["resume", "bank", "project", "projects", "skill", "skills", "unknown"]);
  const companySuffixes = new Set(["co", "company", "corp", "corporation", "inc", "incorporated", "llc", "ltd", "limited"]);
  const employerTerms = tokens(candidate.employer).filter((term) => !genericEmployerTerms.has(term) && !companySuffixes.has(term));
  const roleTerms = tokens(candidate.role);
  return parseBulletDocument(latex)
    .map((list, index) => {
      const labelTerms = new Set(tokens(list.label).filter((term) => !companySuffixes.has(term)));
      // A destination is safe only when the label names the complete source role and
      // employer. Partial title overlap can otherwise move truthful evidence between
      // two different jobs at the same company (for example, Intern and Engineer).
      const employerMatches = employerTerms.length > 0 && employerTerms.every((term) => labelTerms.has(term));
      const roleMatches = roleTerms.length > 0 && roleTerms.every((term) => labelTerms.has(term));
      const matches = employerMatches && roleMatches;
      return { index, matches };
    })
    .filter((result) => result.matches)
    .map((result) => result.index);
}

export interface RankedExperienceBullet {
  id: string;
  entryId: string;
  role: string;
  employer: string;
  bullet: string;
  score: number;
  matchedTerms: string[];
}

/** Deterministic BM25 ranking. Scores are normalized to 0–100 within this bank. */
export function rankExperienceBullets(entries: ExperienceEntry[], jobDescription: string): RankedExperienceBullet[] {
  const documents = entries.flatMap((entry) => entry.bullets.map((bullet, bulletIndex) => ({
    id: `${entry.id}:${bulletIndex}`,
    entryId: entry.id,
    role: entry.role,
    employer: entry.employer,
    bullet,
    terms: tokens(bullet),
  })));
  const queryTerms = [...new Set(tokens(jobDescription))];
  if (documents.length === 0 || queryTerms.length === 0) return documents.map(({ terms: _terms, ...document }) => ({ ...document, score: 0, matchedTerms: [] }));
  const averageLength = documents.reduce((sum, document) => sum + document.terms.length, 0) / documents.length || 1;
  const documentFrequencies = new Map<string, number>();
  for (const term of queryTerms) {
    documentFrequencies.set(term, documents.reduce((count, document) => count + (document.terms.includes(term) ? 1 : 0), 0));
  }
  const raw = documents.map((document) => {
    const frequencies = new Map<string, number>();
    for (const term of document.terms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
    let score = 0;
    const matchedTerms: string[] = [];
    for (const term of queryTerms) {
      const frequency = frequencies.get(term) ?? 0;
      if (!frequency) continue;
      const documentFrequency = documentFrequencies.get(term) ?? 0;
      const inverseDocumentFrequency = Math.log(1 + (documents.length - documentFrequency + 0.5) / (documentFrequency + 0.5));
      const lengthNormalization = 1.2 * (1 - 0.75 + 0.75 * (document.terms.length / averageLength));
      score += inverseDocumentFrequency * ((frequency * 2.2) / (frequency + lengthNormalization));
      matchedTerms.push(term);
    }
    return { ...document, rawScore: score, matchedTerms: matchedTerms.sort().slice(0, 8) };
  });
  const maximum = Math.max(...raw.map((candidate) => candidate.rawScore), 0);
  return raw
    .map(({ terms: _terms, rawScore, ...candidate }) => ({ ...candidate, score: maximum > 0 ? Math.round((rawScore / maximum) * 100) : 0 }))
    .sort((left, right) => right.score - left.score || left.bullet.localeCompare(right.bullet));
}

export interface BulletSwapSuggestion extends RankedExperienceBullet {
  targetListIndex: number;
  targetListLabel: string;
  targetBullet: string;
  targetScore: number;
  scoreGain: number;
}

function readableKey(value: string): string {
  return tokens(decodeBulletText(value)).join(" ");
}

export function suggestBulletSwaps(latex: string, entries: ExperienceEntry[], jobDescription: string, limit = 6): BulletSwapSuggestion[] {
  const lists = parseBulletDocument(latex);
  const targets = lists.flatMap((list, targetListIndex) => list.bullets.map((bullet) => ({ list, targetListIndex, bullet })));
  if (!targets.length) return [];
  const existing = new Set(targets.map((target) => readableKey(target.bullet.text)));
  const targetEntries: ExperienceEntry[] = targets.map((target, index) => ({
    id: `current-${index}`, role: target.list.label, employer: "Current resume", startDate: null, endDate: null, bullets: [target.bullet.text], skills: [],
  }));
  const rankedTogether = rankExperienceBullets([...targetEntries, ...entries], jobDescription);
  const rankedTargets = rankedTogether.filter((candidate) => candidate.entryId.startsWith("current-"));
  const scoreByText = new Map(rankedTargets.map((candidate) => [readableKey(candidate.bullet), candidate.score]));
  const availableTargets = [...targets].sort((left, right) => (scoreByText.get(readableKey(left.bullet.text)) ?? 0) - (scoreByText.get(readableKey(right.bullet.text)) ?? 0));
  const bankEntryIds = new Set(entries.map((entry) => entry.id));
  const rankedCandidates = rankedTogether.filter((candidate) => bankEntryIds.has(candidate.entryId) && candidate.score > 0 && !existing.has(readableKey(candidate.bullet)));
  const suggestions: BulletSwapSuggestion[] = [];
  const usedCandidates = new Set<string>();
  for (const target of availableTargets) {
    const best = rankedCandidates.find((candidate) => {
      if (usedCandidates.has(candidate.id)) return false;
      return compatibleBulletListIndexes(latex, candidate).includes(target.targetListIndex);
    });
    if (!best) continue;
    const targetScore = scoreByText.get(readableKey(target.bullet.text)) ?? 0;
    if (best.score <= targetScore) continue;
    usedCandidates.add(best.id);
    suggestions.push({
      ...best,
      targetListIndex: target.targetListIndex,
      targetListLabel: target.list.label,
      targetBullet: target.bullet.text,
      targetScore,
      scoreGain: best.score - targetScore,
    });
    if (suggestions.length >= limit) break;
  }
  return suggestions;
}

export function escapeLatexText(value: string): string {
  const replacements: Record<string, string> = {
    "\\": "\\textbackslash{}",
    "%": "\\%",
    "&": "\\&",
    "#": "\\#",
    "_": "\\_",
    "$": "\\$",
    "^": "\\textasciicircum{}",
    "~": "\\textasciitilde{}",
    "{": "\\{",
    "}": "\\}",
  };
  return [...value].map((character) => replacements[character] ?? character).join("");
}

export function insertBankBullet(latex: string, targetListIndex: number, bullet: string, replaceText?: string): string {
  const lists = parseBulletDocument(latex);
  const target = lists[targetListIndex];
  if (!target || !bullet.trim()) return latex;
  const incomingKey = readableKey(bullet);
  if (lists.some((list) => list.bullets.some((candidate) => readableKey(candidate.text) === incomingKey))) return latex;
  const item: BulletItem = { id: `bank-${Date.now()}`, latex: escapeLatexText(bullet.trim()), text: bullet.trim() };
  const replaceKey = replaceText ? readableKey(replaceText) : "";
  const next = lists.map((list, listIndex) => {
    if (listIndex !== targetListIndex) return list;
    const replaceIndex = replaceKey ? list.bullets.findIndex((candidate) => readableKey(candidate.text) === replaceKey) : -1;
    const bullets = replaceIndex >= 0
      ? list.bullets.map((candidate, index) => index === replaceIndex ? item : candidate)
      : [...list.bullets, item];
    return { ...list, bullets };
  });
  return applyBulletDocument(latex, next);
}

export function applyBulletSwapSuggestions(latex: string, suggestions: BulletSwapSuggestion[]): string {
  return suggestions.reduce((current, suggestion) => insertBankBullet(current, suggestion.targetListIndex, suggestion.bullet, suggestion.targetBullet), latex);
}
