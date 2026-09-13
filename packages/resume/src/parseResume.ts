import type { ExperienceEntry } from "@ghostboard/shared";
import { latexToPlain, parseBullets, type ResumeBullet } from "./bullets";

/**
 * Structured read of a LaTeX resume: entries with their role, employer, dates,
 * and bullets. Replaces parseMasterLatex, which assumed `\resumeEntry{a}{b}{c}{d}`
 * on one line and produced garbage when the arguments were split across lines
 * (the common formatting, and the one this project's own resume uses).
 */

export interface ParsedResumeEntry {
  id: string;
  /** Job title, project name, or activity. */
  role: string;
  /** Employer, or the project's link/context line. */
  employer: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  bullets: ResumeBullet[];
  section: string | null;
  kind: "experience" | "project" | "activity" | "other";
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12",
};

/** "May 2025" to "2025-05"; "Present" and unparseable text to null. */
export function normalizeResumeDate(value: string): string | null {
  const text = latexToPlain(value).trim();
  if (!text || /^(present|current|ongoing)$/i.test(text)) return null;
  const withMonth = text.match(/([A-Za-z]{3,9})\.?\s+(\d{4})/);
  if (withMonth) {
    const month = MONTHS[withMonth[1].slice(0, 4).toLowerCase()] ?? MONTHS[withMonth[1].slice(0, 3).toLowerCase()];
    if (month) return `${withMonth[2]}-${month}`;
  }
  const yearOnly = text.match(/\b(\d{4})\b/);
  return yearOnly ? yearOnly[1] : null;
}

/** Splits "May 2025 -- Aug. 2025" on an en/em dash or LaTeX `--`. */
export function splitDateRange(value: string): { start: string | null; end: string | null } {
  const parts = latexToPlain(value).split(/\s*(?:--+|–|—|to)\s*/i);
  if (parts.length < 2) return { start: normalizeResumeDate(value), end: null };
  return { start: normalizeResumeDate(parts[0]), end: normalizeResumeDate(parts[1]) };
}

/** Reads `count` brace groups starting at `from`, skipping whitespace and newlines between them. */
function braceArgs(source: string, from: number, count: number): string[] {
  const args: string[] = [];
  let cursor = from;
  for (let taken = 0; taken < count; taken += 1) {
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
    if (source[cursor] !== "{") break;
    let depth = 0;
    const open = cursor;
    for (; cursor < source.length; cursor += 1) {
      if (source[cursor] === "{" && source[cursor - 1] !== "\\") depth += 1;
      else if (source[cursor] === "}" && source[cursor - 1] !== "\\") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) break;
    args.push(source.slice(open + 1, cursor));
    cursor += 1;
  }
  return args;
}

/** `\href{url}{label}` reads as its label; anything else as plain text. */
function linkOrText(value: string): string | null {
  const href = value.match(/\\href\{([^}]*)\}\{([^}]*)\}/);
  if (href) return latexToPlain(href[2]).trim() || href[1].trim() || null;
  return latexToPlain(value).trim() || null;
}

function classify(section: string | null): ParsedResumeEntry["kind"] {
  const name = (section ?? "").toLowerCase();
  if (name.includes("experience") || name.includes("employment") || name.includes("work")) return "experience";
  if (name.includes("project")) return "project";
  if (name.includes("activit") || name.includes("leadership") || name.includes("volunteer")) return "activity";
  return "other";
}

/** Section headings in document order, with their offsets. */
function sections(latex: string): Array<{ name: string; start: number }> {
  return [...latex.matchAll(/\\section\*?\{([^}]*)\}/g)].map((match) => ({
    name: latexToPlain(match[1]).trim(),
    start: match.index!,
  }));
}

export function parseResumeEntries(latex: string): ParsedResumeEntry[] {
  const allBullets = parseBullets(latex);
  const headings = sections(latex);
  const sectionAt = (offset: number) => {
    let name: string | null = null;
    for (const heading of headings) {
      if (heading.start > offset) break;
      name = heading.name;
    }
    return name;
  };

  const marks = [...latex.matchAll(/\\resumeEntry\b/g)];
  const entries: ParsedResumeEntry[] = [];

  for (let index = 0; index < marks.length; index += 1) {
    const start = marks[index].index!;
    const nextMark = index + 1 < marks.length ? marks[index + 1].index! : latex.length;
    const args = braceArgs(latex, start + marks[index][0].length, 4);
    if (args.length < 3) continue;

    const section = sectionAt(start);
    const range = splitDateRange(args[3] ?? "");
    const kind = classify(section);
    // \resumeEntry is {first}{second}{third}{dates}. For a job that reads
    // {employer}{location}{title}; for a project it reads {name}{link}{stack},
    // so the first and third arguments swap meaning.
    const project = kind === "project";
    entries.push({
      id: `e${entries.length}`,
      role: latexToPlain((project ? args[0] : args[2]) ?? "").trim(),
      employer: latexToPlain((project ? args[2] : args[0]) ?? "").trim(),
      location: linkOrText(args[1] ?? ""),
      startDate: range.start,
      endDate: range.end,
      // Bullets between this entry and the next one belong to this entry.
      bullets: allBullets.filter((bullet) => bullet.start > start && bullet.start < nextMark),
      section,
      kind,
    });
  }
  return entries;
}

/** Free-text skill lines (`\textbf{Languages:} C++, Python`) outside any entry. */
export function parseResumeSkills(latex: string): string[] {
  const skills = new Set<string>();
  // The value runs to the end of the line, but must survive escaped specials
  // like `C\#`; stopping at the first backslash truncated the language list.
  for (const match of latex.matchAll(/\\textbf\{([^}]*?):\s*\}?\s*((?:[^\\\n]|\\[&%$#_{}])+)/g)) {
    const label = latexToPlain(match[1]).toLowerCase();
    if (!/language|framework|tool|skill|technolog|concept/.test(label)) continue;
    for (const raw of latexToPlain(match[2]).split(/[,;]/)) {
      const skill = raw.replace(/\\\\|\[\d+pt\]/g, "").trim();
      if (skill.length >= 2 && skill.length <= 40) skills.add(skill);
    }
  }
  return [...skills];
}

/**
 * Resume to experience-bank records. This is the autofill path: open a .tex and
 * the bank is populated with real positions instead of hand-typed ones.
 */
export function resumeToExperienceBank(latex: string): ExperienceEntry[] {
  const skills = parseResumeSkills(latex);
  return parseResumeEntries(latex)
    .filter((entry) => entry.bullets.length > 0)
    .map((entry) => ({
      id: `resume:${entry.kind}:${entry.employer}:${entry.role}`.toLowerCase().replace(/[^a-z0-9:]+/g, "-"),
      role: entry.role,
      employer: entry.employer,
      startDate: entry.startDate,
      endDate: entry.endDate,
      bullets: entry.bullets.map((bullet) => bullet.text),
      // Skills are declared once for the whole resume, so attach the ones a
      // bullet actually mentions rather than all of them to every entry.
      skills: skills.filter((skill) =>
        entry.bullets.some((bullet) => bullet.text.toLowerCase().includes(skill.toLowerCase())),
      ),
      source: entry.kind,
    }));
}
