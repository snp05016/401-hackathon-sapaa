import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanLatexText, computeSideBySideDiff, diffLatex, parseChangesSummaryFallback, validateLatex } from "./latex";

const VALID_LATEX = [
  "\\documentclass{article}",
  "\\begin{document}",
  "Experienced software engineer with LaTeX knowledge.",
  "\\end{document}",
].join("\n");

test("validateLatex accepts a complete document", () => {
  assert.deepEqual(validateLatex(VALID_LATEX), { valid: true, errors: [] });
});

test("validateLatex rejects empty input", () => {
  const result = validateLatex("");
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("LaTeX output is empty."));
});

test("validateLatex rejects missing document structure", () => {
  const result = validateLatex("plain text without latex");
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("documentclass")));
  assert.ok(result.errors.some((error) => error.includes("begin{document}")));
  assert.ok(result.errors.some((error) => error.includes("end{document}")));
});

test("validateLatex rejects markdown code fences", () => {
  const result = validateLatex("```latex\n" + VALID_LATEX + "\n```");
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("fences")));
});

test("validateLatex rejects unbalanced braces", () => {
  const result = validateLatex([
    "\\documentclass{article}",
    "\\begin{document}",
    "{",
    "\\end{document}",
  ].join("\n"));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("braces")));
});

test("diffLatex reports added and removed lines", () => {
  const before = [
    "\\documentclass{article}",
    "\\begin{document}",
    "Built web services at Acme.",
    "\\end{document}",
  ].join("\n");
  const after = [
    "\\documentclass{article}",
    "\\begin{document}",
    "Built backend services at Acme.",
    "\\end{document}",
  ].join("\n");
  const changes = diffLatex(before, after);
  assert.ok(changes.some((change) => change.startsWith("Removed line 3: Built web services at Acme.")));
  assert.ok(changes.some((change) => change.startsWith("Added line 3: Built backend services at Acme.")));
});

test("diffLatex returns an empty list for identical documents", () => {
  assert.deepEqual(diffLatex(VALID_LATEX, VALID_LATEX), []);
});

test("cleanLatexText strips commands, comments, and decodes characters", () => {
  assert.equal(
    cleanLatexText("\\resumeItem{Supported \\textbf{system design} for \\textbf{Docker} and \\textbf{FastAPI},...}"),
    "Supported system design for Docker and FastAPI,...",
  );
  assert.equal(
    cleanLatexText("\\item{\\textbf{Languages:}}{ Python, TypeScript, C++ }"),
    "Languages: Python, TypeScript, C++",
  );
  assert.equal(
    cleanLatexText("% Swappable skill slots: exactly 1 full line"),
    "",
  );
  assert.equal(
    cleanLatexText("Cost was \\$100 \\& savings were 20\\% across all \\_modules\\_"),
    "Cost was $100 & savings were 20% across all _modules_",
  );
});

test("computeSideBySideDiff pairs changed lines into Before and After without LaTeX", () => {
  const before = [
    "\\documentclass{article}",
    "\\begin{document}",
    "\\section{Experience}",
    "\\resumeSubheading{Acme Corp}{Remote}{Software Engineer}{2024}",
    "\\resumeItemListStart",
    "  \\resumeItem{Architected a full-stack \\textbf{AI platform} with \\textbf{FastAPI}.}",
    "  \\resumeItem{Maintained existing legacy pipelines.}",
    "\\resumeItemListEnd",
    "% Some comment line",
    "\\end{document}",
  ].join("\n");

  const after = [
    "\\documentclass{article}",
    "\\begin{document}",
    "\\section{Experience}",
    "\\resumeSubheading{Acme Corp}{Remote}{Software Engineer}{2024}",
    "\\resumeItemListStart",
    "  \\resumeItem{Supported \\textbf{system design} for an AI platform with \\textbf{FastAPI}.}",
    "  \\resumeItem{Maintained existing legacy pipelines.}",
    "\\resumeItemListEnd",
    "\\end{document}",
  ].join("\n");

  const diff = computeSideBySideDiff(before, after);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].type, "modified");
  assert.equal(diff[0].section, "Acme Corp");
  assert.equal(diff[0].before?.text, "Architected a full-stack AI platform with FastAPI.");
  assert.equal(diff[0].after?.text, "Supported system design for an AI platform with FastAPI.");
});

test("parseChangesSummaryFallback pairs legacy changesSummary lines into side-by-side items", () => {
  const summary = [
    "Added line 131: \\resumeItem{Supported \\textbf{system design}...}",
    "Removed line 131: \\resumeItem{Architected a \\textbf{full-stack}...}",
    "Removed line 144: % Some comment line",
  ];
  const items = parseChangesSummaryFallback(summary);
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "modified");
  assert.equal(items[0].before?.line, 131);
  assert.equal(items[0].before?.text, "Architected a full-stack...");
  assert.equal(items[0].after?.line, 131);
  assert.equal(items[0].after?.text, "Supported system design...");
});