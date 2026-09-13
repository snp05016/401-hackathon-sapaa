/**
 * Surgical bullet editing. The .tex file stays the source of truth: bullets are
 * located by character offset and written back by slicing, so the preamble,
 * macros, and spacing a user never asked to change are preserved byte-for-byte.
 */

export interface ResumeBullet {
  /** Stable within one parse of one document; offsets move, so re-parse after editing. */
  id: string;
  /** Raw LaTeX between `\item` and the next `\item`/`\end{itemize}`, trimmed. */
  latex: string;
  /** The same content as prose, for a user who does not write LaTeX. */
  text: string;
  /** Character offsets of `latex` within the source document. */
  start: number;
  end: number;
  /** Nearest preceding \section{...}, for grouping in the UI. */
  section: string | null;
  /** Nearest preceding \resumeEntry, when one applies. */
  employer: string | null;
  role: string | null;
}

const SPECIALS: Record<string, string> = {
  "&": "\\&", "%": "\\%", "$": "\\$", "#": "\\#", "_": "\\_",
  "{": "\\{", "}": "\\}",
  "~": "\\textasciitilde{}", "^": "\\textasciicircum{}",
};

const UNESCAPE: Array<[RegExp, string]> = [
  [/\\textasciitilde\{\}/g, "~"],
  [/\\textasciicircum\{\}/g, "^"],
  [/\\textbackslash\{\}/g, "\\"],
  [/\\([&%$#_{}])/g, "$1"],
];

/**
 * LaTeX to prose. Escaped specials become plain characters; real commands
 * (\textbf, \href) are left intact rather than mangled, so a bullet that uses
 * them survives a round trip through the plain-text editor.
 */
export function latexToPlain(latex: string): string {
  let text = latex;
  for (const [pattern, replacement] of UNESCAPE) text = text.replace(pattern, replacement);
  return text.replace(/[ \t]+/g, " ").trim();
}

/**
 * Prose to LaTeX. Escapes bare specials so "30% faster" and "R&D" compile,
 * while leaving an existing `\command` and an already-escaped `\%` untouched.
 */
export function plainToLatex(text: string): string {
  let out = "";
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "\\") {
      const next = text[index + 1] ?? "";
      if (/[a-zA-Z]/.test(next)) {
        // A command: copy its name and any brace arguments verbatim, so
        // \textbf{...} and \href{...}{...} survive instead of being escaped
        // into literal braces.
        let cursor = index + 1;
        while (cursor < text.length && /[a-zA-Z]/.test(text[cursor])) cursor += 1;
        while (text[cursor] === "{") {
          let depth = 0;
          for (; cursor < text.length; cursor += 1) {
            if (text[cursor] === "{" && text[cursor - 1] !== "\\") depth += 1;
            else if (text[cursor] === "}" && text[cursor - 1] !== "\\") {
              depth -= 1;
              if (depth === 0) { cursor += 1; break; }
            }
          }
          if (depth !== 0) break;
        }
        out += text.slice(index, cursor);
        index = cursor - 1;
        continue;
      }
      if (next && "&%$#_{}".includes(next)) {
        out += character + next;
        index += 1;
        continue;
      }
      out += "\\textbackslash{}";
      continue;
    }
    out += SPECIALS[character] ?? character;
  }
  return out.trim();
}

function lastMatchBefore(source: string, pattern: RegExp, limit: number): RegExpExecArray | null {
  let found: RegExpExecArray | null = null;
  const scanner = new RegExp(pattern.source, "g");
  let match: RegExpExecArray | null;
  while ((match = scanner.exec(source)) !== null) {
    if (match.index >= limit) break;
    found = match;
  }
  return found;
}

/** Reads the n-th brace group of a command, tolerating whitespace and newlines between groups. */
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
    args.push(source.slice(open + 1, cursor));
    cursor += 1;
  }
  return args;
}

/** Every `\item` inside an itemize block, with the offsets needed to edit it in place. */
export function parseBullets(latex: string): ResumeBullet[] {
  const bullets: ResumeBullet[] = [];
  const blocks = latex.matchAll(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g);

  for (const block of blocks) {
    const blockStart = block.index! + block[0].indexOf(block[1]);
    const body = block[1];
    const items = [...body.matchAll(/\\item\b/g)];

    for (let index = 0; index < items.length; index += 1) {
      const afterItem = items[index].index! + items[index][0].length;
      const bodyEnd = index + 1 < items.length ? items[index + 1].index! : body.length;
      const raw = body.slice(afterItem, bodyEnd);
      const leading = raw.length - raw.trimStart().length;
      const content = raw.trim();
      if (!content) continue;

      const start = blockStart + afterItem + leading;
      const section = lastMatchBefore(latex, /\\section\*?\{([^}]*)\}/, start);
      const entry = lastMatchBefore(latex, /\\resumeEntry\b/, start);
      const entryArgs = entry ? braceArgs(latex, entry.index + entry[0].length, 3) : [];

      bullets.push({
        id: `b${bullets.length}`,
        latex: content,
        text: latexToPlain(content),
        start,
        end: start + content.length,
        section: section ? section[1].trim() : null,
        employer: entryArgs[0]?.trim() || null,
        role: entryArgs[2]?.trim() || null,
      });
    }
  }
  return bullets;
}

export interface BulletEdit {
  id: string;
  /** Replacement as prose; escaped on the way in. Use `latex` instead to write raw. */
  text?: string;
  latex?: string;
}

/**
 * Applies edits by slicing, right to left so earlier offsets stay valid. Only
 * the edited spans change; every other byte of the document is preserved.
 */
export function applyBulletEdits(source: string, bullets: ResumeBullet[], edits: BulletEdit[]): string {
  const byId = new Map(bullets.map((bullet) => [bullet.id, bullet]));
  const resolved = edits
    .map((edit) => {
      const bullet = byId.get(edit.id);
      if (!bullet) throw new Error(`Unknown bullet id: ${edit.id}`);
      const replacement = edit.latex ?? (edit.text === undefined ? null : plainToLatex(edit.text));
      if (replacement === null) throw new Error(`Edit for ${edit.id} supplied neither text nor latex.`);
      return { bullet, replacement };
    })
    .sort((a, b) => b.bullet.start - a.bullet.start);

  const seen = new Set<string>();
  let out = source;
  for (const { bullet, replacement } of resolved) {
    if (seen.has(bullet.id)) throw new Error(`Duplicate edit for bullet ${bullet.id}.`);
    seen.add(bullet.id);
    out = out.slice(0, bullet.start) + replacement + out.slice(bullet.end);
  }
  return out;
}
