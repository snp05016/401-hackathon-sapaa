import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { applyBulletEdits, latexToPlain, parseBullets, plainToLatex } from "./bullets";
import { validateLatex } from "./latex";

const master = readFileSync(fileURLToPath(new URL("../../../resume_fixed.tex", import.meta.url)), "utf8");

test("bullets are located in a real resume with section and employer context", () => {
  const bullets = parseBullets(master);
  assert.ok(bullets.length >= 10, `expected many bullets, got ${bullets.length}`);

  const first = bullets.find((bullet) => bullet.latex.startsWith("Developed REST APIs"));
  assert.ok(first, "the first experience bullet should be found");
  assert.equal(first.section, "Experience");
  assert.equal(first.employer, "TechWorks Inc.");
  assert.equal(first.role, "Software Developer Intern");
  // The offsets must point at exactly the bullet text in the source.
  assert.equal(master.slice(first.start, first.end), first.latex);
});

test("editing one bullet leaves every other byte of the document untouched", () => {
  const bullets = parseBullets(master);
  const target = bullets.find((bullet) => bullet.latex.startsWith("Developed REST APIs"))!;
  const edited = applyBulletEdits(master, bullets, [{ id: target.id, text: "Shipped REST APIs in Python serving 200+ staff" }]);

  assert.ok(edited.includes("Shipped REST APIs in Python serving 200+ staff"));
  assert.ok(!edited.includes("Developed REST APIs using Python and Flask"));
  // Preamble and macros survive byte-for-byte.
  const preamble = master.slice(0, master.indexOf("\\begin{document}"));
  assert.equal(edited.slice(0, preamble.length), preamble);
  assert.ok(validateLatex(edited).valid);
  // Only the edited bullet differs.
  const changed = master.split("\n").filter((line, index) => line !== edited.split("\n")[index]);
  assert.equal(changed.length, 1);
});

test("multiple edits apply together without corrupting each other's offsets", () => {
  const bullets = parseBullets(master);
  const [a, b, c] = bullets;
  const edited = applyBulletEdits(master, bullets, [
    { id: a.id, text: "First rewritten" },
    { id: c.id, text: "Third rewritten" },
    { id: b.id, text: "Second rewritten" },
  ]);
  for (const phrase of ["First rewritten", "Second rewritten", "Third rewritten"]) {
    assert.ok(edited.includes(phrase), `${phrase} should be present`);
  }
  assert.ok(validateLatex(edited).valid);
  // Re-parsing the result finds the new text at correct offsets.
  const reparsed = parseBullets(edited);
  assert.equal(reparsed[0].text, "First rewritten");
  assert.equal(edited.slice(reparsed[1].start, reparsed[1].end), reparsed[1].latex);
});

test("a non-LaTeX user can type specials without breaking the build", () => {
  assert.equal(plainToLatex("Cut costs 30% in R&D"), "Cut costs 30\\% in R\\&D");
  assert.equal(plainToLatex("Used file_name and $5M budget"), "Used file\\_name and \\$5M budget");
  assert.equal(latexToPlain("Cut costs 30\\% in R\\&D"), "Cut costs 30% in R&D");

  const bullets = parseBullets(master);
  const edited = applyBulletEdits(master, bullets, [{ id: bullets[0].id, text: "Raised margin 30% for R&D spend of $2M" }]);
  assert.ok(validateLatex(edited).valid, "escaped output must still be valid LaTeX");
  assert.ok(edited.includes("30\\%"));
  assert.ok(!/[^\\]%\s/.test(edited.slice(edited.indexOf("Raised margin"), edited.indexOf("Raised margin") + 60)));
});

test("existing LaTeX commands survive a plain-text round trip", () => {
  const original = "Built \\textbf{Dungeon Quest}, a game with 30\\% faster loads";
  const plain = latexToPlain(original);
  assert.equal(plain, "Built \\textbf{Dungeon Quest}, a game with 30% faster loads");
  // The command is preserved, the bare % is re-escaped, and nothing is double-escaped.
  assert.equal(plainToLatex(plain), original);
});

test("already-escaped input is never double-escaped", () => {
  assert.equal(plainToLatex("Already 30\\% escaped"), "Already 30\\% escaped");
  assert.equal(plainToLatex(plainToLatex("30% raw")), "30\\% raw");
});

test("a bare backslash becomes a literal rather than a broken command", () => {
  assert.equal(plainToLatex("path \\ here"), "path \\textbackslash{} here");
  assert.ok(validateLatex(`\\documentclass{article}\\begin{document}${plainToLatex("a \\ b")}\\end{document}`).valid);
});

test("unknown ids and duplicate edits are refused rather than silently dropped", () => {
  const bullets = parseBullets(master);
  assert.throws(() => applyBulletEdits(master, bullets, [{ id: "nope", text: "x" }]), /Unknown bullet id/);
  assert.throws(() => applyBulletEdits(master, bullets, [{ id: bullets[0].id, text: "a" }, { id: bullets[0].id, text: "b" }]), /Duplicate edit/);
  assert.throws(() => applyBulletEdits(master, bullets, [{ id: bullets[0].id }]), /neither text nor latex/);
});

test("a multi-line bullet keeps its full body", () => {
  const source = [
    "\\documentclass{article}", "\\begin{document}", "\\section{Experience}", "\\begin{itemize}",
    "    \\item Wrote a long bullet that",
    "    wraps across two lines.",
    "    \\item Second bullet.",
    "\\end{itemize}", "\\end{document}",
  ].join("\n");
  const bullets = parseBullets(source);
  assert.equal(bullets.length, 2);
  assert.match(bullets[0].latex, /wraps across two lines\.$/);
  assert.equal(bullets[1].text, "Second bullet.");
  assert.equal(source.slice(bullets[0].start, bullets[0].end), bullets[0].latex);
});
