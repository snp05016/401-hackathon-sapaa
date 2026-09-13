/**
 * Bullet-level view of a LaTeX resume, so bullets can be reordered, moved between
 * roles, or dropped back in without the reader ever seeing LaTeX.
 *
 * Every bullet keeps its original LaTeX (bold, escapes and all); only the ordering
 * is rewritten, so a round trip through here leaves an untouched document byte-identical.
 */

export interface BulletItem {
  id: string;
  /** The bullet's raw LaTeX body, preserved verbatim when rewriting. */
  latex: string;
  /** Readable text for the UI. */
  text: string;
}

export interface BulletList {
  id: string;
  /** Role, project, or section this list of bullets sits under. */
  label: string;
  bullets: BulletItem[];
  /** How bullets are written back: the resume-template macro or a plain itemize item. */
  style: "resumeItem" | "item";
  /** Character span of the list's inner content in the source document. */
  start: number;
  end: number;
  indent: string;
  /** Whitespace between the last bullet and the closing delimiter, kept so an untouched list round-trips exactly. */
  trailer: string;
}

const LIST_DELIMITERS: Array<{ open: string; close: string; style: BulletList["style"] }> = [
  { open: "\\resumeItemListStart", close: "\\resumeItemListEnd", style: "resumeItem" },
  { open: "\\begin{itemize}", close: "\\end{itemize}", style: "item" },
];

export function decodeBulletText(latex: string): string {
  const literal: Record<string, string> = {
    "\\": "\uE000",
    "{": "\uE001",
    "}": "\uE002",
    "$": "\uE003",
    "%": "\uE004",
    "&": "\uE005",
    "#": "\uE006",
    "_": "\uE007",
  };
  return latex
    .replace(/\\textbackslash\{\}/g, literal["\\"])
    .replace(/\\textasciitilde\{\}/g, "~")
    .replace(/\\textasciicircum\{\}/g, "^")
    .replace(/\\(?:textbf|textit|emph|texttt|underline|textrm)\{([^{}]*)\}/g, "$1")
    .replace(/\\href\{[^{}]*\}\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:vspace|hspace)\*?\{[^{}]*\}/g, " ")
    .replace(/\\(?:large|Large|LARGE|small|footnotesize|normalsize|scshape|bfseries|itshape)\b/g, " ")
    .replace(/\\\\\s*(?:\[[^\]]*\])?/g, " ")
    .replace(/\\([%&#$_{}])/g, (_match, character: string) => literal[character])
    .replace(/[${}]/g, "")
    .replace(/[\uE000-\uE007]/g, (marker) => Object.entries(literal).find(([, value]) => value === marker)?.[0] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Escapes user-entered plain text so an inline bullet edit remains valid LaTeX. */
export function encodeBulletText(text: string): string {
  const replacements: Record<string, string> = {
    "\\": "\\textbackslash{}",
    "{": "\\{",
    "}": "\\}",
    "$": "\\$",
    "&": "\\&",
    "#": "\\#",
    "%": "\\%",
    "_": "\\_",
    "~": "\\textasciitilde{}",
    "^": "\\textasciicircum{}",
  };
  return text.replace(/[\\{}$&#%_~^]/g, (character) => replacements[character]);
}

function readBracedArgument(source: string, openIndex: number): { value: string; nextIndex: number } | null {
  if (source[openIndex] !== "{") return null;
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index - 1] === "\\") continue;
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return { value: source.slice(openIndex + 1, index), nextIndex: index + 1 };
    }
  }
  return null;
}

/** The role, project, or section heading closest above `index`. */
function labelFor(latex: string, index: number): string {
  const before = latex.slice(0, index);
  const candidates: Array<{ at: number; value: string }> = [];
  for (const command of ["\\resumeSubheading", "\\resumeProjectHeading", "\\resumeEntry", "\\subsection", "\\section"]) {
    const at = before.lastIndexOf(command);
    if (at < 0) continue;
    let cursor = at + command.length;
    while (/[\s*]/.test(latex[cursor] ?? "")) cursor += 1;
    const argument = readBracedArgument(latex, cursor);
    if (argument) candidates.push({ at, value: argument.value });
  }
  const nearest = candidates.sort((a, b) => b.at - a.at)[0];
  return nearest ? decodeBulletText(nearest.value) || "Bullets" : "Bullets";
}

function parseBullets(body: string, style: BulletList["style"], listId: string): BulletItem[] {
  const bullets: BulletItem[] = [];
  if (style === "resumeItem") {
    let cursor = 0;
    while (bullets.length < 100) {
      const at = body.indexOf("\\resumeItem", cursor);
      if (at < 0) break;
      const argument = readBracedArgument(body, at + "\\resumeItem".length);
      if (!argument) break;
      bullets.push({ id: `${listId}-${bullets.length}`, latex: argument.value.trim(), text: decodeBulletText(argument.value) });
      cursor = argument.nextIndex;
    }
    return bullets;
  }
  // ponytail: `\item` runs to the next `\item` or the end of the list — good enough
  // until someone nests an itemize inside a bullet.
  const itemRegex = /\\item\b\s*(?:\[[^\]]*\])?([\s\S]*?)(?=\\item\b|$)/g;
  let match;
  while ((match = itemRegex.exec(body)) !== null && bullets.length < 100) {
    const latex = match[1].trim();
    if (latex) bullets.push({ id: `${listId}-${bullets.length}`, latex, text: decodeBulletText(latex) });
  }
  return bullets;
}

/** Lists inside a skills section are label/value rows, not draggable bullets. */
function inSkillsSection(latex: string, index: number): boolean {
  const heading = latex.slice(0, index).lastIndexOf("\\section");
  if (heading < 0) return false;
  return /skill|technolog/i.test(latex.slice(heading, heading + 60));
}

export function parseBulletDocument(latex: string): BulletList[] {
  const lists: BulletList[] = [];
  for (const { open, close, style } of LIST_DELIMITERS) {
    let cursor = 0;
    while (lists.length < 60) {
      const openIndex = latex.indexOf(open, cursor);
      if (openIndex < 0) break;
      const start = openIndex + open.length;
      const closeIndex = latex.indexOf(close, start);
      cursor = closeIndex < 0 ? start : closeIndex + close.length;
      if (closeIndex < 0) break;
      if (inSkillsSection(latex, openIndex)) continue;
      const body = latex.slice(start, closeIndex);
      const id = `${style}-${openIndex}`;
      const bullets = parseBullets(body, style, id);
      if (!bullets.length) continue;
      lists.push({
        id,
        label: labelFor(latex, openIndex),
        bullets,
        style,
        start,
        end: closeIndex,
        indent: body.match(/\n([ \t]+)/)?.[1] ?? "    ",
        trailer: body.match(/(\n[ \t]*)$/)?.[1] ?? "\n",
      });
    }
  }
  return lists.sort((a, b) => a.start - b.start);
}

function renderList(list: BulletList, bullets: BulletItem[]): string {
  const lines = bullets.map((bullet) => list.style === "resumeItem"
    ? `${list.indent}\\resumeItem{${bullet.latex}}`
    : `${list.indent}\\item ${bullet.latex}`);
  return lines.length ? `\n${lines.join("\n")}${list.trailer}` : list.trailer;
}

/**
 * Writes the given bullet ordering back into the document. Lists are spliced from the
 * end so earlier offsets stay valid.
 */
export function applyBulletDocument(latex: string, lists: BulletList[]): string {
  let result = latex;
  for (const list of [...lists].sort((a, b) => b.start - a.start)) {
    result = result.slice(0, list.start) + renderList(list, list.bullets) + result.slice(list.end);
  }
  return result;
}

function bulletKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Bullets the master resume has that the tailored one dropped — the bench to drag back from. */
export function benchBullets(masterLatex: string, tailoredLatex: string): BulletItem[] {
  const kept = new Set(parseBulletDocument(tailoredLatex).flatMap((list) => list.bullets.map((bullet) => bulletKey(bullet.text))));
  const bench: BulletItem[] = [];
  const seen = new Set<string>();
  for (const list of parseBulletDocument(masterLatex)) {
    for (const bullet of list.bullets) {
      const key = bulletKey(bullet.text);
      if (!key || kept.has(key) || seen.has(key)) continue;
      seen.add(key);
      bench.push({ ...bullet, id: `bench-${bench.length}` });
    }
  }
  return bench;
}
