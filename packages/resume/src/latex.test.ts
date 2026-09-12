import assert from "node:assert/strict";
import { test } from "node:test";
import { diffLatex, validateLatex } from "./latex";

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