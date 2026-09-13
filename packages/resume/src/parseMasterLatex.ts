export interface ParsedExperienceEntry {
  role: string;
  employer: string;
  location?: string | null;
  startDate: string | null;
  endDate: string | null;
  bullets: string[];
  skills?: string[];
  source?: "experience" | "project" | "skill";
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
  result = result.replace(/\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny|scshape|bfseries|itshape|rmfamily|sffamily|mdseries|upshape)\b/g, " ");
  result = result.replace(/\\\\/g, " ");
  result = result.replace(/\\hfill/g, " ");
  result = result.replace(/\\vspace\{[^}]*\}/g, " ");
  result = result.replace(/\\hspace\{[^}]*\}/g, " ");
  result = result.replace(/\{\}/g, "");
  result = result.replace(/\\([%&#$_{}])/g, "$1");
  result = result.replace(/[${}]/g, "");
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

const DATE_TOKEN_PATTERN = String.raw`(?:${Object.keys(MONTH_MAP).join("|")})[a-z]*\.?\s+(?:\d{1,2},?\s+)?(?:19|20)\d{2}|(?:19|20)\d{2}`;
const DATE_RANGE_PATTERN = new RegExp(
  String.raw`(${DATE_TOKEN_PATTERN})\s*(?:[–—]|-{1,2}|to)\s*(present|current|now|today|${DATE_TOKEN_PATTERN})`,
  "i",
);

function looksLikeDateArgument(value: string): boolean {
  return /\b(?:19|20)(?:\d{2}|xx)\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b|\b(?:present|current|now|today)\b/i.test(value);
}

function inferRoleAndEmployer(first: string, third: string): { role: string; employer: string } {
  const roleSignal = /\b(?:engineer|developer|intern|assistant|researcher|manager|analyst|designer|scientist|architect|consultant|professor|coordinator|director|specialist|administrator|lead|teacher|instructor)\b/i;
  const organizationSignal = /\b(?:inc\.?|corp\.?|llc|ltd\.?|university|college|lab|laborator(?:y|ies)|technolog(?:y|ies)|company|marketplace|studio|group|school|institute)\b/i;
  if (roleSignal.test(first) && !roleSignal.test(third)) return { role: first, employer: third };
  if (organizationSignal.test(first) && roleSignal.test(third)) return { role: third, employer: first };
  return { role: third, employer: first };
}

function extractDateRange(text: string): { start: string | null; end: string | null } {
  const normalized = text.replace(/\\\\/g, " ").replace(/\s+/g, " ");
  const rangeMatch = normalized.match(DATE_RANGE_PATTERN);
  if (!rangeMatch) return { start: null, end: null };

  const start = parseDateToken(rangeMatch[1].trim());
  const end = parseDateToken(rangeMatch[2].trim());
  return { start, end };
}

function removeDateRange(text: string): string {
  return text
    .replace(DATE_RANGE_PATTERN, " ")
    .replace(/\s*(?:--|[–—-])\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
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
      const selectedMatch = sep.name === "comma" ? matches[0] : matches[matches.length - 1];
      const splitIndex = (selectedMatch.index ?? 0) + selectedMatch[0].length;
      const role = removeDateRange(text.slice(0, selectedMatch.index ?? 0));
      const employer = text.slice(splitIndex).trim();
      if (role || employer) return { role, employer };
    }
  }
  return { role: text, employer: "" };
}

function extractBullets(itemizeContent: string): string[] {
  const bullets: string[] = [];
  const itemRegex = /\\?item\s*(?:\[[^\]]*\])?\s*([\s\S]*?)(?=\\?item|\\end\{itemize\}|$)/g;
  let match;
  while ((match = itemRegex.exec(itemizeContent)) !== null) {
    const content = decodeLatexText(match[1]);
    if (content) bullets.push(content.slice(0, 1000));
    if (bullets.length >= 100) break;
  }
  return bullets;
}

function readBraceArgument(source: string, openingBraceIndex: number): { value: string; nextIndex: number } | null {
  if (source[openingBraceIndex] !== "{") return null;
  let depth = 0;
  for (let index = openingBraceIndex; index < source.length; index += 1) {
    if (source[index] === "{" && source[index - 1] !== "\\") depth += 1;
    if (source[index] === "}" && source[index - 1] !== "\\") {
      depth -= 1;
      if (depth === 0) return { value: source.slice(openingBraceIndex + 1, index), nextIndex: index + 1 };
    }
  }
  return null;
}

function readCommandArguments(source: string, command: string, startIndex: number, argumentCount: number): { values: string[]; nextIndex: number } | null {
  const commandEnd = startIndex + command.length;
  let cursor = commandEnd;
  const values: string[] = [];
  while (values.length < argumentCount) {
    while (/\s/.test(source[cursor] ?? "")) cursor += 1;
    const argument = readBraceArgument(source, cursor);
    if (!argument) return null;
    values.push(argument.value);
    cursor = argument.nextIndex;
  }
  return { values, nextIndex: cursor };
}

function extractMacroBullets(body: string): string[] {
  const bullets: string[] = [];
  const command = "\\resumeItem";
  let cursor = 0;
  while (cursor < body.length && bullets.length < 100) {
    const commandIndex = body.indexOf(command, cursor);
    if (commandIndex < 0) break;
    if (body[commandIndex + command.length] !== "{") {
      cursor = commandIndex + command.length;
      continue;
    }
    const argument = readCommandArguments(body, command, commandIndex, 1);
    if (!argument) break;
    const bullet = decodeLatexText(argument.values[0]);
    if (bullet) bullets.push(bullet.slice(0, 1000));
    cursor = argument.nextIndex;
  }
  return bullets;
}

export function parseResumeSubheadingEntries(sectionBody: string): ParsedExperienceEntry[] {
  const entries: ParsedExperienceEntry[] = [];
  const command = "\\resumeSubheading";
  let cursor = 0;
  while (cursor < sectionBody.length && entries.length < 50) {
    const commandIndex = sectionBody.indexOf(command, cursor);
    if (commandIndex < 0) break;
    const arguments_ = readCommandArguments(sectionBody, command, commandIndex, 4);
    if (!arguments_) break;

    const bodyEnd = sectionBody.indexOf(command, arguments_.nextIndex);
    const body = sectionBody.slice(arguments_.nextIndex, bodyEnd < 0 ? sectionBody.length : bodyEnd);
    const firstArgument = decodeLatexText(arguments_.values[0]).slice(0, 200);
    const thirdArgument = decodeLatexText(arguments_.values[2]).slice(0, 200);
    const { role, employer } = inferRoleAndEmployer(firstArgument, thirdArgument);
    // Jake-style templates conventionally use either {company}{location}
    // {role}{dates} or {company}{dates}{role}{location}. Accept both forms;
    // the sample resume and several real templates use the latter ordering.
    const secondArgument = decodeLatexText(arguments_.values[1]);
    const fourthArgument = decodeLatexText(arguments_.values[3]);
    const fourthRange = extractDateRange(fourthArgument);
    const secondIsDate = looksLikeDateArgument(secondArgument);
    const fourthIsDate = Boolean(fourthRange.start || fourthRange.end) || looksLikeDateArgument(fourthArgument);
    // Prefer the argument that visibly looks like a date. When neither does,
    // retain the conventional company/location/role/dates ordering.
    const dateIsFourth = fourthIsDate && !secondIsDate;
    const dateText = dateIsFourth ? fourthArgument : secondIsDate ? secondArgument : fourthArgument;
    const locationText = dateIsFourth || !secondIsDate ? secondArgument : fourthArgument;
    const { start, end } = extractDateRange(dateText);
    const bullets = extractMacroBullets(body);
    if (role || employer) {
      entries.push({
        role,
        employer,
        location: decodeLatexText(locationText).slice(0, 200) || null,
        startDate: start,
        endDate: end,
        bullets,
        source: "experience",
      });
    }
    cursor = arguments_.nextIndex;
  }
  return entries;
}

function parseResumeProjectFormat(sectionBody: string): ParsedExperienceEntry[] {
  const entries: ParsedExperienceEntry[] = [];
  const command = "\\resumeProjectHeading";
  let cursor = 0;
  while (cursor < sectionBody.length && entries.length < 50) {
    const commandIndex = sectionBody.indexOf(command, cursor);
    if (commandIndex < 0) break;
    const arguments_ = readCommandArguments(sectionBody, command, commandIndex, 2);
    if (!arguments_) break;

    const bodyEnd = sectionBody.indexOf(command, arguments_.nextIndex);
    const body = sectionBody.slice(arguments_.nextIndex, bodyEnd < 0 ? sectionBody.length : bodyEnd);
    const heading = decodeLatexText(arguments_.values[0]);
    const separatorIndex = heading.indexOf("|");
    const role = (separatorIndex >= 0 ? heading.slice(0, separatorIndex) : heading).trim().slice(0, 200);
    const skills = (separatorIndex >= 0 ? heading.slice(separatorIndex + 1) : arguments_.values[1])
      .split(",")
      .map((skill) => decodeLatexText(skill).trim())
      .filter(Boolean)
      .slice(0, 100);
    const bullets = extractMacroBullets(body);
    if (role) entries.push({ role, employer: "Project", startDate: null, endDate: null, bullets, skills, source: "project" });
    cursor = arguments_.nextIndex;
  }
  return entries;
}

function parseSkillsFormat(sectionBody: string): ParsedExperienceEntry[] {
  const entries: ParsedExperienceEntry[] = [];
  const skillRegex = /\\textbf\{([^{}]+)\}\s*:\s*([^\n]*)/g;
  let match;
  while ((match = skillRegex.exec(sectionBody)) !== null && entries.length < 50) {
    const label = decodeLatexText(match[1]).trim();
    const skills = match[2]
      .split(",")
      .map((skill) => decodeLatexText(skill).trim())
      .filter(Boolean)
      .slice(0, 100);
    if (label && skills.length) {
      entries.push({ role: label, employer: "Skills", startDate: null, endDate: null, bullets: [], skills, source: "skill" });
    }
  }
  return entries;
}

function findSection(latex: string, name: string): string {
  const sectionMatch = latex.match(new RegExp(`\\\\section\\*?\\{[^}]*${name}[^}]*\\}\\s*([\\s\\S]*?)(?=\\\\section\\*?\\{|\\\\end\\{document\\}|$)`, "i"));
  return sectionMatch?.[1] ?? "";
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
    const itemizeMatch = body.match(/\\?begin\{itemize\}([\s\S]*?)\\?end\{itemize\}/);
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
  const itemizeRegex = /\\?begin\{itemize\}([\s\S]*?)\\?end\{itemize\}/g;
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
  const sectionBody = findSection(latex, "(?:experience|employment)");
  let entries: ParsedExperienceEntry[] = [];

  const resumeSubheadingEntries = sectionBody ? parseResumeSubheadingEntries(sectionBody) : [];
  if (resumeSubheadingEntries.length > 0) {
    entries = resumeSubheadingEntries;
  } else {
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
  }

  const projectEntries = parseResumeProjectFormat(findSection(latex, "projects?"));
  const skillEntries = parseSkillsFormat(findSection(latex, "skills?"));
  return [...entries.slice(0, 50), ...projectEntries, ...skillEntries]
    .filter((entry) => entry.role.trim() || entry.employer.trim())
    .slice(0, 100);
}
