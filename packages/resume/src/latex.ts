const MAX_DIFF_SUMMARIES = 100;
const MAX_LCS_CELLS = 1_000_000;

export interface LatexValidationResult {
  valid: boolean;
  errors: string[];
}

function withoutComment(line: string): string {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== "%") continue;
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && line[cursor] === "\\"; cursor -= 1) slashes += 1;
    if (slashes % 2 === 0) return line.slice(0, index);
  }
  return line;
}

function braceBalance(source: string): number {
  let balance = 0;
  for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
    const content = withoutComment(line);
    for (let index = 0; index < content.length; index += 1) {
      const character = content[index];
      if (character !== "{" && character !== "}") continue;
      let slashes = 0;
      for (let cursor = index - 1; cursor >= 0 && content[cursor] === "\\"; cursor -= 1) slashes += 1;
      if (slashes % 2 === 1) continue;
      balance += character === "{" ? 1 : -1;
      if (balance < 0) return balance;
    }
  }
  return balance;
}

export function validateLatex(source: string): LatexValidationResult {
  const latex = source.trim();
  const errors: string[] = [];
  const documentClassIndex = latex.search(/\\documentclass(?:\[[^\]]*\])?\s*\{[^}]+\}/);
  const beginIndex = latex.indexOf("\\begin{document}");
  const endIndex = latex.lastIndexOf("\\end{document}");

  if (!latex) errors.push("LaTeX output is empty.");
  if (documentClassIndex < 0) errors.push("Missing \\documentclass declaration.");
  if (beginIndex < 0) errors.push("Missing \\begin{document}.");
  if (endIndex < 0) errors.push("Missing \\end{document}.");
  if (documentClassIndex >= 0 && beginIndex >= 0 && documentClassIndex > beginIndex) {
    errors.push("\\documentclass must appear before \\begin{document}.");
  }
  if (beginIndex >= 0 && endIndex >= 0 && beginIndex >= endIndex) errors.push("Document boundaries are out of order.");
  if (latex.includes("```")) errors.push("Markdown code fences are not valid LaTeX output.");
  if (braceBalance(latex) !== 0) errors.push("Unbalanced LaTeX braces.");

  return { valid: errors.length === 0, errors };
}

function previewLine(line: string): string {
  const cleaned = cleanLatexText(line);
  const normalized = (cleaned || line.trim()).replace(/\s+/g, " ") || "(blank line)";
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

function fallbackDiff(before: string[], after: string[]): string[] {
  const summaries: string[] = [];
  const length = Math.max(before.length, after.length);
  for (let index = 0; index < length && summaries.length < MAX_DIFF_SUMMARIES; index += 1) {
    if (before[index] === after[index]) continue;
    if (before[index] !== undefined) summaries.push(`Removed line ${index + 1}: ${previewLine(before[index])}`);
    if (after[index] !== undefined && summaries.length < MAX_DIFF_SUMMARIES) {
      summaries.push(`Added line ${index + 1}: ${previewLine(after[index])}`);
    }
  }
  return summaries;
}

export function diffLatex(before: string, after: string): string[] {
  const normalizedBefore = before.replace(/\r\n?/g, "\n").trimEnd();
  const normalizedAfter = after.replace(/\r\n?/g, "\n").trimEnd();
  if (normalizedBefore === normalizedAfter) return [];

  const beforeLines = normalizedBefore.split("\n");
  const afterLines = normalizedAfter.split("\n");
  const columns = afterLines.length + 1;
  const cells = (beforeLines.length + 1) * columns;
  if (cells > MAX_LCS_CELLS) return fallbackDiff(beforeLines, afterLines);

  const lengths = new Uint32Array(cells);
  for (let beforeIndex = 1; beforeIndex <= beforeLines.length; beforeIndex += 1) {
    for (let afterIndex = 1; afterIndex <= afterLines.length; afterIndex += 1) {
      const cell = beforeIndex * columns + afterIndex;
      lengths[cell] = beforeLines[beforeIndex - 1] === afterLines[afterIndex - 1]
        ? lengths[(beforeIndex - 1) * columns + afterIndex - 1] + 1
        : Math.max(lengths[(beforeIndex - 1) * columns + afterIndex], lengths[cell - 1]);
    }
  }

  const changes: string[] = [];
  let beforeIndex = beforeLines.length;
  let afterIndex = afterLines.length;
  while ((beforeIndex > 0 || afterIndex > 0) && changes.length < MAX_DIFF_SUMMARIES) {
    if (beforeIndex > 0 && afterIndex > 0 && beforeLines[beforeIndex - 1] === afterLines[afterIndex - 1]) {
      beforeIndex -= 1;
      afterIndex -= 1;
      continue;
    }

    const removeScore = beforeIndex > 0 ? lengths[(beforeIndex - 1) * columns + afterIndex] : -1;
    const addScore = afterIndex > 0 ? lengths[beforeIndex * columns + afterIndex - 1] : -1;
    if (afterIndex > 0 && addScore > removeScore) {
      changes.push(`Added line ${afterIndex}: ${previewLine(afterLines[afterIndex - 1])}`);
      afterIndex -= 1;
    } else if (beforeIndex > 0) {
      changes.push(`Removed line ${beforeIndex}: ${previewLine(beforeLines[beforeIndex - 1])}`);
      beforeIndex -= 1;
    }
  }

  return changes.reverse();
}

/** Strips LaTeX macros, styling tags, commands, and comments into human-readable text. */
export function cleanLatexText(text: string): string {
  let s = text.trim();
  if (!s || /^%/.test(s)) return "";

  // Extract argument from \resumeItem{...}
  const resumeItemMatch = s.match(/^\\resumeItem\{([\s\S]*)\}\s*$/);
  if (resumeItemMatch) s = resumeItemMatch[1];

  // Strip leading \item
  s = s.replace(/^\\item\s*(?:\[[^\]]*\])?\s*/, "");

  // Repeatedly strip formatting commands to handle nested expressions
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(/\\(?:textbf|textit|emph|texttt|underline|textrm|textsc|textsf|textmd)\{([^{}]*)\}/g, "$1");
    s = s.replace(/\\href\{[^{}]*\}\{([^{}]*)\}/g, "$1");
  }

  // Remove spacing and styling macros
  s = s.replace(/\\(?:vspace|hspace)\*?\{[^{}]*\}/g, " ");
  s = s.replace(/\\(?:large|Large|LARGE|huge|Huge|small|footnotesize|scriptsize|tiny|normalsize|scshape|bfseries|itshape)\b/g, " ");
  s = s.replace(/\\\\\s*(?:\[[^\]]*\])?/g, " ");
  s = s.replace(/\\hfill\b/g, " ");

  // Unescape LaTeX control characters
  s = s.replace(/\\([%&#$_{}])/g, "$1");
  s = s.replace(/\\textbackslash\{\}/g, "\\");
  s = s.replace(/\\textasciitilde\{\}/g, "~");
  s = s.replace(/\\textasciicircum\{\}/g, "^");
  s = s.replace(/---/g, "—").replace(/--/g, "–");

  // Remove dangling braces
  s = s.replace(/[{}]/g, "");

  return s.replace(/\s+/g, " ").trim();
}

/** Detects if a line is comments or pure LaTeX document/list structure with no user content. */
export function isStructuralLatex(line: string): boolean {
  const s = line.trim();
  if (!s || s.startsWith("%")) return true;
  return /^\\(resumeItemListStart|resumeItemListEnd|resumeSubHeadingListStart|resumeSubHeadingListEnd|begin\{itemize\}|end\{itemize\}|begin\{document\}|end\{document\})\s*$/.test(s);
}

export interface SideBySideDiffItem {
  id: string;
  type: "modified" | "added" | "removed";
  section?: string;
  before?: {
    line?: number;
    text: string;
    raw: string;
  };
  after?: {
    line?: number;
    text: string;
    raw: string;
  };
}

/** Finds the nearest section/role/company heading in the LaTeX source preceding a line. */
export function getSectionContext(latex: string, lineNumber: number): string | undefined {
  const lines = latex.split("\n");
  const targetIndex = lines.slice(0, lineNumber).join("\n").length;
  const before = latex.slice(0, targetIndex);

  const candidates: Array<{ at: number; val: string }> = [];
  for (const cmd of ["\\resumeSubheading", "\\resumeProjectHeading", "\\resumeEntry", "\\subsection", "\\section"]) {
    const at = before.lastIndexOf(cmd);
    if (at >= 0) {
      let cursor = at + cmd.length;
      while (/[\s*]/.test(latex[cursor] || "")) cursor += 1;
      if (latex[cursor] === "{") {
        let depth = 0;
        let start = cursor;
        let end = cursor;
        for (let i = cursor; i < latex.length; i += 1) {
          if (latex[i - 1] === "\\") continue;
          if (latex[i] === "{") depth += 1;
          else if (latex[i] === "}") {
            depth -= 1;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
        const val = cleanLatexText(latex.slice(start + 1, end));
        if (val) candidates.push({ at, val });
      }
    }
  }
  candidates.sort((a, b) => b.at - a.at);
  return candidates[0]?.val;
}

/**
 * Computes a human-readable, side-by-side diff between two LaTeX resumes, pairing
 * modified bullets and lines with LaTeX commands and internal comments stripped out.
 */
export function computeSideBySideDiff(before: string, after: string): SideBySideDiffItem[] {
  const normalizedBefore = before.replace(/\r\n?/g, "\n").trimEnd();
  const normalizedAfter = after.replace(/\r\n?/g, "\n").trimEnd();
  if (!normalizedBefore && !normalizedAfter) return [];
  if (normalizedBefore === normalizedAfter) return [];

  const beforeLines = normalizedBefore ? normalizedBefore.split("\n") : [];
  const afterLines = normalizedAfter ? normalizedAfter.split("\n") : [];

  const columns = afterLines.length + 1;
  const cells = (beforeLines.length + 1) * columns;

  if (cells > MAX_LCS_CELLS) {
    const maxLen = Math.max(beforeLines.length, afterLines.length);
    const items: SideBySideDiffItem[] = [];
    for (let i = 0; i < maxLen; i += 1) {
      const bRaw = beforeLines[i];
      const aRaw = afterLines[i];
      if (bRaw === aRaw) continue;
      const bClean = bRaw ? cleanLatexText(bRaw) : "";
      const aClean = aRaw ? cleanLatexText(aRaw) : "";
      if (isStructuralLatex(bRaw || "") && isStructuralLatex(aRaw || "")) continue;
      if (bClean && aClean) {
        items.push({
          id: `diff-fb-${i}`,
          type: "modified",
          section: getSectionContext(normalizedBefore, i + 1) || getSectionContext(normalizedAfter, i + 1),
          before: { line: i + 1, text: bClean, raw: bRaw },
          after: { line: i + 1, text: aClean, raw: aRaw },
        });
      } else if (bClean) {
        items.push({
          id: `diff-fb-${i}`,
          type: "removed",
          section: getSectionContext(normalizedBefore, i + 1),
          before: { line: i + 1, text: bClean, raw: bRaw },
        });
      } else if (aClean) {
        items.push({
          id: `diff-fb-${i}`,
          type: "added",
          section: getSectionContext(normalizedAfter, i + 1),
          after: { line: i + 1, text: aClean, raw: aRaw },
        });
      }
    }
    return items;
  }

  const lengths = new Uint32Array(cells);
  for (let b = 1; b <= beforeLines.length; b += 1) {
    for (let a = 1; a <= afterLines.length; a += 1) {
      const cell = b * columns + a;
      lengths[cell] = beforeLines[b - 1] === afterLines[a - 1]
        ? lengths[(b - 1) * columns + a - 1] + 1
        : Math.max(lengths[(b - 1) * columns + a], lengths[cell - 1]);
    }
  }

  let b = beforeLines.length;
  let a = afterLines.length;
  type DiffOp =
    | { type: "equal"; beforeLine: number; afterLine: number }
    | { type: "remove"; beforeLine: number; text: string }
    | { type: "add"; afterLine: number; text: string };

  const ops: DiffOp[] = [];

  while (b > 0 || a > 0) {
    if (b > 0 && a > 0 && beforeLines[b - 1] === afterLines[a - 1]) {
      ops.push({ type: "equal", beforeLine: b, afterLine: a });
      b -= 1;
      a -= 1;
    } else {
      const removeScore = b > 0 ? lengths[(b - 1) * columns + a] : -1;
      const addScore = a > 0 ? lengths[b * columns + a - 1] : -1;
      if (a > 0 && addScore >= removeScore) {
        ops.push({ type: "add", afterLine: a, text: afterLines[a - 1] });
        a -= 1;
      } else if (b > 0) {
        ops.push({ type: "remove", beforeLine: b, text: beforeLines[b - 1] });
        b -= 1;
      }
    }
  }

  ops.reverse();

  interface Hunk {
    removed: Array<{ line: number; raw: string }>;
    added: Array<{ line: number; raw: string }>;
  }
  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;

  for (const op of ops) {
    if (op.type === "equal") {
      if (currentHunk) {
        hunks.push(currentHunk);
        currentHunk = null;
      }
    } else {
      if (!currentHunk) currentHunk = { removed: [], added: [] };
      if (op.type === "remove") currentHunk.removed.push({ line: op.beforeLine, raw: op.text });
      if (op.type === "add") currentHunk.added.push({ line: op.afterLine, raw: op.text });
    }
  }
  if (currentHunk) hunks.push(currentHunk);

  const items: SideBySideDiffItem[] = [];
  let itemId = 0;

  for (const hunk of hunks) {
    const removed = hunk.removed
      .filter((r) => !isStructuralLatex(r.raw))
      .map((r) => ({ ...r, clean: cleanLatexText(r.raw) }))
      .filter((r) => r.clean.length > 0);

    const added = hunk.added
      .filter((a) => !isStructuralLatex(a.raw))
      .map((a) => ({ ...a, clean: cleanLatexText(a.raw) }))
      .filter((a) => a.clean.length > 0);

    const maxCount = Math.max(removed.length, added.length);
    for (let i = 0; i < maxCount; i += 1) {
      const r = removed[i];
      const a = added[i];
      itemId += 1;

      if (r && a) {
        if (r.clean !== a.clean) {
          items.push({
            id: `diff-${itemId}`,
            type: "modified",
            section: getSectionContext(normalizedBefore, r.line) || getSectionContext(normalizedAfter, a.line),
            before: { line: r.line, text: r.clean, raw: r.raw },
            after: { line: a.line, text: a.clean, raw: a.raw },
          });
        }
      } else if (r) {
        items.push({
          id: `diff-${itemId}`,
          type: "removed",
          section: getSectionContext(normalizedBefore, r.line),
          before: { line: r.line, text: r.clean, raw: r.raw },
        });
      } else if (a) {
        items.push({
          id: `diff-${itemId}`,
          type: "added",
          section: getSectionContext(normalizedAfter, a.line),
          after: { line: a.line, text: a.clean, raw: a.raw },
        });
      }
    }
  }

  return items;
}

/** Fallback parser that decodes raw changesSummary strings into clean side-by-side items. */
export function parseChangesSummaryFallback(lines: string[]): SideBySideDiffItem[] {
  const linePattern = /^(Added|Removed) line (\d+):\s*(.*)$/;
  const removedMap = new Map<number, Array<{ lineNum: number; clean: string; raw: string }>>();
  const addedMap = new Map<number, Array<{ lineNum: number; clean: string; raw: string }>>();

  for (const line of lines) {
    const match = line.match(linePattern);
    if (!match) continue;
    const [, kind, lineNumStr, rawText] = match;
    const lineNum = parseInt(lineNumStr, 10);
    const clean = cleanLatexText(rawText);
    if (!clean) continue;

    if (kind === "Removed") {
      if (!removedMap.has(lineNum)) removedMap.set(lineNum, []);
      removedMap.get(lineNum)!.push({ lineNum, clean, raw: rawText });
    } else {
      if (!addedMap.has(lineNum)) addedMap.set(lineNum, []);
      addedMap.get(lineNum)!.push({ lineNum, clean, raw: rawText });
    }
  }

  const allLineNums = Array.from(new Set([...removedMap.keys(), ...addedMap.keys()])).sort((a, b) => a - b);
  const items: SideBySideDiffItem[] = [];
  let itemId = 0;

  for (const lineNum of allLineNums) {
    const remList = removedMap.get(lineNum) || [];
    const addList = addedMap.get(lineNum) || [];
    const maxCount = Math.max(remList.length, addList.length);

    for (let i = 0; i < maxCount; i += 1) {
      const r = remList[i];
      const a = addList[i];
      itemId += 1;
      if (r && a) {
        items.push({
          id: `diff-fb-${itemId}`,
          type: "modified",
          before: { line: r.lineNum, text: r.clean, raw: r.raw },
          after: { line: a.lineNum, text: a.clean, raw: a.raw },
        });
      } else if (r) {
        items.push({
          id: `diff-fb-${itemId}`,
          type: "removed",
          before: { line: r.lineNum, text: r.clean, raw: r.raw },
        });
      } else if (a) {
        items.push({
          id: `diff-fb-${itemId}`,
          type: "added",
          after: { line: a.lineNum, text: a.clean, raw: a.raw },
        });
      }
    }
  }

  return items;
}
