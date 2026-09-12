export interface ParsedExperienceEntry {
  role: string;
  employer: string;
  startDate: string | null;
  endDate: string | null;
  bullets: string[];
}

const MONTH_MAP: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

function stripComments(latex: string): string {
  let result = "";
  let inComment = false;
  for (let i = 0; i < latex.length; i += 1) {
    if (inComment) {
      if (latex[i] === "\n") {
        inComment = false;
        result += "\n";
      }
      continue;
    }
    if (latex[i] === "%") {
      let slashes = 0;
      for (let j = i - 1; j >= 0 && latex[j] === "\\"; j -= 1) slashes += 1;
      if (slashes % 2 === 0) {
        inComment = true;
        continue;
      }
    }
    result += latex[i];
  }
  return result;
}

function decodeLatexText(text: string): string {
  let result = text;
  result = result.replace(/\\(textbf|textit|emph|texttt|underline)\{([^{}]*)\}/g, (_m, _cmd, inner) => inner);
  result = result.replace(/\\\\/g, " ");
  result = result.replace(/\\hfill/g, " ");
  result = result.replace(/\\vspace\{[^}]*\}/g, " ");
  result = result.replace(/\\hspace\{[^}]*\}/g, " ");
  result = result.replace(/\{\}/g, "");
  result = result.replace(/\\([%&#$_{}])/g, "$1");
  result = result.replace(/\s+/g, " ");
  return result.trim();
}

function parseDateToken(token: string): string | null {
  const lower = token.toLowerCase().trim();
  if (lower === "present" || lower === "current" || lower === "now" || lower === "today") return null;
  const monthYearDay = token.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)[a-z]*\.?\s+(\d{1,2})?,?\s+(\d{4})$/i);
  if (monthYearDay) {
    const month = MONTH_MAP[monthYearDay[1].toLowerCase().slice(0, 3)];
    const day = monthYearDay[2] ? monthYearDay[2].padStart(2, "0") : "01";
    const year = monthYearDay[3];
    const y = parseInt(year, 10);
    if (y >= 1900 && y <= 2100) return `${year}-${month}-${day}`;
    return null;
  }
  const monthYear = token.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)[a-z]*\.?\s+(\d{4})$/i);
  if (monthYear) {
    const month = MONTH_MAP[monthYear[1].toLowerCase().slice(0, 3)];
    const year = monthYear[2];
    const y = parseInt(year, 10);
    if (y >= 1900 && y <= 2100) return `${year}-${month}-01`;
    return null;
  }
  const yearOnly = token.match(/^(?:19|20)\d{2}$/);
  if (yearOnly) {
    const y = parseInt(yearOnly[0], 10);
    if (y >= 1900 && y <= 2100) return `${yearOnly[0]}-01-01`;
    return null;
  }
  return null;
}

function extractDateRange(text: string): { start: string | null; end: string | null } {
  const normalized = text.replace(/\\\\/g, " ").replace(/\s+/g, " ");
  const rangeMatch = normalized.match(
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)[a-z]*\.?\s+\d{1,2}?,?\s+\d{4}|\d{4}\s*[–—\-]\s*\d{4}|\d{4}\s+to\s+\d{4}|(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)[a-z]*\.?\s+\d{4}\s*[–—\-]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)[a-z]*\.?\s+\d{4}|(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)[a-z]*\.?\s+\d{4}\s*[–—\-]\s*(present|current|now|today)|(\d{4})\s*[–—\-]\s*(present|current|now|today)|(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)[a-z]*\.?\s+\d{1,2}?,?\s+\d{4}\s*[–—\-]\s*(present|current|now|today)/i
  );
  if (!rangeMatch) return { start: null, end: null };

  const fullMatch = rangeMatch[0];
  const parts = fullMatch.split(/\s*(?:[–—\-]|to)\s*/i);
  if (parts.length < 2) return { start: null, end: null };

  const start = parseDateToken(parts[0].trim());
  const end = parseDateToken(parts[1].trim());
  return { start, end };
}

function splitRoleEmployer(heading: string): { role: string; employer: string } {
  const text = heading.trim();
  if (!text) return { role: "", employer: "" };

  const separators = [
    { regex: /\s+at\s+/gi, name: "at" },
    { regex: /\s+[–—\-]\s+/g, name: "dash" },
    { regex: /\s+\|\s+/g, name: "pipe" },
    { regex: /,\s+/g, name: "comma" },
  ];

  for (const sep of separators) {
    const matches = [...text.matchAll(sep.regex)];
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const splitIndex = (lastMatch.index ?? 0) + lastMatch[0].length;
      const role = text.slice(0, lastMatch.index ?? 0).trim();
      const employer = text.slice(splitIndex).trim();
      if (role || employer) return { role, employer };
    }
  }
  return { role: text, employer: "" };
}

function extractBullets(itemizeContent: string): string[] {
  const bullets: string[] = [];
  const itemRegex = /\\item\s*(?:\[[^\]]*\])?\s*([\s\S]*?)(?=\\item|\\end\{itemize\}|$)/g;
  let match;
  while ((match = itemRegex.exec(itemizeContent)) !== null) {
    const content = decodeLatexText(match[1]);
    if (content) bullets.push(content.slice(0, 1000));
    if (bullets.length >= 100) break;
  }
  return bullets;
}

function parseSubsectionFormat(sectionBody: string): ParsedExperienceEntry[] {
  const entries: ParsedExperienceEntry[] = [];
  const subsectionRegex = /\\subsection\*?\{([^}]*)\}\s*([\s\S]*?)(?=\\subsection\*?\{|\\section\*?\{|\\end\{document\}|$)/g;
  let match;
  while ((match = subsectionRegex.exec(sectionBody)) !== null) {
    const heading = decodeLatexText(match[1]);
    const body = match[2];
    const { role, employer } = splitRoleEmployer(heading);
    const { start, end } = extractDateRange(heading + "\n" + body.split("\n")[0]);
    let bullets: string[] = [];
    const itemizeMatch = body.match(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/);
    if (itemizeMatch) {
      bullets = extractBullets(itemizeMatch[1]);
    }
    if (role.trim() || employer.trim()) {
      entries.push({
        role: role.slice(0, 200),
        employer: employer.slice(0, 200),
        startDate: start,
        endDate: end,
        bullets,
      });
    }
  }
  return entries;
}

function parseItemizeFormat(sectionBody: string): ParsedExperienceEntry[] {
  const entries: ParsedExperienceEntry[] = [];
  const itemizeRegex = /\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g;
  let lastEnd = 0;
  let match;
  while ((match = itemizeRegex.exec(sectionBody)) !== null) {
    const beforeBlock = sectionBody.slice(lastEnd, match.index);
    const lines = beforeBlock.split("\n").map(l => l.trim()).filter(Boolean);
    const headerLines = lines.slice(-3);
    const headerText = headerLines.join("\n");
    const body = match[1];

    let role = "";
    let employer = "";
    let startDate: string | null = null;
    let endDate: string | null = null;

    const boldMatches = [...headerText.matchAll(/\\textbf\{([^}]*)\}/g)];
    const italicMatches = [...headerText.matchAll(/\\textit\{([^}]*)\}/g)];

    if (boldMatches.length > 0) {
      const boldText = decodeLatexText(boldMatches[boldMatches.length - 1][1]);
      const { role: r, employer: e } = splitRoleEmployer(boldText);
      role = r;
      employer = e;
    }
    if (!employer && italicMatches.length > 0) {
      employer = decodeLatexText(italicMatches[italicMatches.length - 1][1]).split(",")[0].trim();
    }
    if (!role && !employer) {
      const { role: r, employer: e } = splitRoleEmployer(headerText);
      role = r;
      employer = e;
    }

    const { start, end } = extractDateRange(headerText);
    startDate = start;
    endDate = end;

    const bullets = extractBullets(body);
    if (role.trim() || employer.trim()) {
      entries.push({
        role: role.slice(0, 200),
        employer: employer.slice(0, 200),
        startDate,
        endDate,
        bullets,
      });
    }
    lastEnd = match.index + match[0].length;
  }
  return entries;
}

function parseParagraphFormat(sectionBody: string): ParsedExperienceEntry[] {
  const entries: ParsedExperienceEntry[] = [];
  const paragraphs = sectionBody.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  for (const para of paragraphs) {
    const boldMatch = para.match(/\\textbf\{([^}]*)\}/);
    if (!boldMatch) continue;
    const role = decodeLatexText(boldMatch[1]).slice(0, 200);
    const { start, end } = extractDateRange(para);
    if (role) {
      entries.push({ role, employer: "", startDate: start, endDate: end, bullets: [] });
    }
  }
  return entries;
}

export function parseMasterLatex(masterLatex: string): ParsedExperienceEntry[] {
  const latex = stripComments(masterLatex);
  const sectionMatch = latex.match(/\\section\*?\{([^}]*(?:experience|employment)[^}]*)\}\s*([\s\S]*?)(?=\\section\*?\{|\\end\{document\}|$)/i);
  if (!sectionMatch) return [];

  const sectionBody = sectionMatch[2];
  let entries: ParsedExperienceEntry[] = [];

  const subsectionEntries = parseSubsectionFormat(sectionBody);
  if (subsectionEntries.length > 0) {
    entries = subsectionEntries;
  } else {
    const itemizeEntries = parseItemizeFormat(sectionBody);
    if (itemizeEntries.length > 0) {
      entries = itemizeEntries;
    } else {
      entries = parseParagraphFormat(sectionBody);
    }
  }

  return entries.filter(e => e.role.trim() || e.employer.trim()).slice(0, 50);
}