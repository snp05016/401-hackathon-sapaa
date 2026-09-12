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
  const normalized = line.trim().replace(/\s+/g, " ") || "(blank line)";
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
