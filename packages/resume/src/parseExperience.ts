import { parseSkillList } from "./parseMasterLatex";
import type { ResumeEducation, ResumeExperience, ResumeProject, ResumeReference } from "@ghostboard/shared";

export type JobExperience = ResumeExperience;

const EXPERIENCE_SECTION_KEYWORDS = [
  "Work Experience",
  "Professional Experience",
  "Employment History",
  "Work History",
  "Experience",
  "Career History",
  "Employment",
];

function normalizeLatexSource(latex: string): string {
  return latex.replace(/\r\n?/g, "\n");
}

function sectionPattern(keyword: string): RegExp {
  return new RegExp(`\\\\section\\*?\\{${escapeRegExp(keyword)}\\}`, "i");
}

function findExperienceSection(latex: string): string | null {
  for (const keyword of EXPERIENCE_SECTION_KEYWORDS) {
    const escapedKeyword = escapeRegExp(keyword);
    const regex = new RegExp(`\\\\section\\*?\\{${escapedKeyword}\\}`, "i");
    const match = latex.match(regex);
    if (match) {
      const startIndex = match.index! + match[0].length;
      const nextSectionMatch = latex.slice(startIndex).match(/\\section\*?\{[^}]+\}/);
      const endIndex = nextSectionMatch ? startIndex + nextSectionMatch.index! : latex.length;
      return latex.slice(startIndex, endIndex).trim();
    }
  }
  return null;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, (match) => `\\${match}`);
}

function cleanupLatexText(value: string): string {
  return value
    .replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\(?:begin|end)\{[^}]*\}/g, "")
    .replace(/\\section\*?\{([^}]*)\}/g, "$1")
    .replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, "$2 ($1)")
    .replace(/\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, " ")
    .replace(/\\(?:textbf|textit|emph|underline)\{([^{}]*)\}/g, "$1")
    .replace(/\\item\b/g, "")
    .replace(/\\\\/g, " ")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\s*/g, " ")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function parseHeaderLine(line: string): { title: string; dateRange: string | null } | null {
  const bold = line.match(/\\textbf\{([^}]+)\}/);
  if (!bold) return null;
  const afterTitle = line.slice((bold.index ?? 0) + bold[0].length);
  const dateMatch = afterTitle.match(/(?:--|\\hfill)\s*([^\\]+?)(?:\\\\)?\s*$/);
  return {
    title: cleanupLatexText(bold[1]),
    dateRange: dateMatch ? cleanupLatexText(dateMatch[1]) : null,
  };
}

function parseCompanyLocation(line: string): { company: string; location: string | null } | null {
  const match = line.match(/\\textit\{([^}]+)\}/);
  if (match) {
    const parts = cleanupLatexText(match[1]).split(",").map((p) => p.trim()).filter(Boolean);
    return {
      company: parts[0] || "",
      location: parts.slice(1).join(", ") || null,
    };
  }
  return null;
}

function parseBullets(content: string): string[] {
  const bullets: string[] = [];
  const itemRegex = /\\item\s+([\s\S]*?)(?=\n\s*\\item\b|\n\s*\\end\{itemize\}|$)/g;
  let match;
  while ((match = itemRegex.exec(content)) !== null) {
    const bullet = cleanupLatexText(match[1]);
    if (bullet) bullets.push(bullet);
  }
  return bullets;
}

export function parseJobExperiences(latex: string): ResumeExperience[] {
  const experienceSection = findExperienceSection(normalizeLatexSource(latex));
  if (!experienceSection) return [];

  const experiences: ResumeExperience[] = [];
  const lines = experienceSection.split("\n").map((l) => l.trim()).filter(Boolean);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("\\textbf{")) {
      const titleDate = parseHeaderLine(line);
      if (!titleDate) {
        i++;
        continue;
      }

      i++;
      if (i >= lines.length) break;

      const companyLine = lines[i];
      const companyLoc = parseCompanyLocation(companyLine);
      if (!companyLoc) {
        i++;
        continue;
      }

      i++;
      let bulletContent = "";
      while (i < lines.length && !lines[i].startsWith("\\textbf{")) {
        bulletContent += lines[i] + "\n";
        i++;
      }

      const bullets = parseBullets(bulletContent);

      experiences.push({
        title: titleDate.title,
        dateRange: titleDate.dateRange,
        company: companyLoc.company,
        location: companyLoc.location,
        bullets,
      });
    } else {
      i++;
    }
  }

  return experiences;
}

export function experiencesToJson(experiences: JobExperience[]): string {
  return JSON.stringify(experiences, null, 2);
}

function parseSections(latex: string): Array<{ heading: string; latex: string; text: string }> {
  const normalized = normalizeLatexSource(latex);
  const sectionRegex = /\\section\*?\{([^}]+)\}/g;
  const matches = [...normalized.matchAll(sectionRegex)];
  return matches.map((match, index) => {
    const startIndex = (match.index ?? 0) + match[0].length;
    const endIndex = index + 1 < matches.length ? matches[index + 1].index ?? normalized.length : normalized.length;
    const sectionLatex = normalized.slice(startIndex, endIndex).trim();
    return {
      heading: cleanupLatexText(match[1]),
      latex: sectionLatex,
      text: cleanupLatexText(sectionLatex),
    };
  });
}

function findSection(sections: Array<{ heading: string; latex: string; text: string }>, keywords: string[]) {
  return sections.find((section) => keywords.some((keyword) => section.heading.toLowerCase().includes(keyword)));
}

function parseContact(latex: string, sections: Array<{ heading: string; latex: string; text: string }>): ResumeReference["contact"] {
  const normalized = normalizeLatexSource(latex);
  const firstSection = normalized.search(/\\section\*?\{/);
  const header = firstSection >= 0 ? normalized.slice(0, firstSection) : normalized;
  const text = cleanupLatexText(header);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  const phone = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] ?? null;
  const links = [...text.matchAll(/https?:\/\/\S+|(?:linkedin\.com|github\.com)\/\S+/gi)].map((match) => match[0]);
  const headerParts = text.split(/\s+\|\s+| {2,}/).map((part) => part.trim()).filter(Boolean);
  const centeredLines = (normalized.match(/\\begin\{center\}([\s\S]*?)\\end\{center\}/)?.[1] ?? "")
    .split("\n")
    .map((line) => cleanupLatexText(line))
    .filter(Boolean);
  const name = (centeredLines[0] ?? cleanupLatexText(headerParts[0] ?? "")) || null;
  const location = headerParts.find((part) => !part.includes("@") && !phone?.includes(part) && !links.includes(part) && part !== name) ?? null;
  const summary = findSection(sections, ["summary"])?.text ?? "";
  return { name: name || null, email, phone, location, links: [...new Set(links.concat(summary.match(/https?:\/\/\S+/g) ?? []))] };
}



function parseEducation(sectionLatex: string | undefined): ResumeEducation[] {
  if (!sectionLatex) return [];
  const lines = sectionLatex.split("\n").map((line) => line.trim()).filter(Boolean);
  const education: ResumeEducation[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const header = parseHeaderLine(lines[index]);
    if (!header) continue;
    const nextItalic = lines[index + 1]?.match(/\\textit\{([^}]+)\}/);
    const parts = nextItalic ? cleanupLatexText(nextItalic[1]).split(",").map((part) => part.trim()).filter(Boolean) : [];
    const details: string[] = [];
    let cursor = nextItalic ? index + 2 : index + 1;
    while (cursor < lines.length && !lines[cursor].startsWith("\\textbf{")) {
      const detail = cleanupLatexText(lines[cursor]);
      if (detail) details.push(detail);
      cursor += 1;
    }
    education.push({
      degree: header.title,
      school: parts[0] ?? header.title,
      location: parts.slice(1).join(", ") || null,
      dateRange: header.dateRange,
      details,
    });
  }
  return education;
}

function parseProjects(sectionLatex: string | undefined): ResumeProject[] {
  if (!sectionLatex) return [];
  const projects: ResumeProject[] = [];
  const lines = sectionLatex.split("\n").map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const header = parseHeaderLine(lines[index]);
    if (!header) continue;
    let bulletSource = "";
    index += 1;
    while (index < lines.length && !lines[index].startsWith("\\textbf{")) {
      bulletSource += `${lines[index]}\n`;
      index += 1;
    }
    index -= 1;
    projects.push({ name: header.title, dateRange: header.dateRange, bullets: parseBullets(bulletSource) });
  }
  return projects;
}

export function parseResumeReference(latex: string): ResumeReference {
  const sections = parseSections(latex);
  const summary = findSection(sections, ["summary"])?.text ?? null;
  const skillsSection = findSection(sections, ["skill", "technology", "technical"]);
  const educationSection = findSection(sections, ["education"]);
  const projectSection = findSection(sections, ["project"]);
  return {
    contact: parseContact(latex, sections),
    summary,
    skills: parseSkillList(skillsSection?.latex ?? ""),
    experience: parseJobExperiences(latex),
    education: parseEducation(educationSection?.latex),
    projects: parseProjects(projectSection?.latex),
    sections: sections.map((section) => ({ heading: section.heading, text: section.text })),
    plainText: cleanupLatexText(latex),
  };
}

export function resumeReferenceToJson(reference: ResumeReference): string {
  return JSON.stringify(reference, null, 2);
}
