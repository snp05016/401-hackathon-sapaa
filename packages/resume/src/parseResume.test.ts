import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { normalizeResumeDate, parseResumeEntries, parseResumeSkills, resumeToExperienceBank, splitDateRange } from "./parseResume";

const master = readFileSync(fileURLToPath(new URL("../../../resume_fixed.tex", import.meta.url)), "utf8");

test("entries parse from a real resume whose macro arguments span multiple lines", () => {
  const entries = parseResumeEntries(master);
  const jobs = entries.filter((entry) => entry.kind === "experience");
  assert.equal(jobs.length, 2);

  const [first] = jobs;
  assert.equal(first.role, "Software Developer Intern");
  assert.equal(first.employer, "TechWorks Inc.");
  assert.equal(first.location, "Toronto, ON");
  assert.equal(first.startDate, "2025-05");
  assert.equal(first.endDate, "2025-08");
  assert.equal(first.bullets.length, 4);
  assert.match(first.bullets[0].text, /^Developed REST APIs/);
});

test("a project names itself rather than its tech stack", () => {
  const projects = parseResumeEntries(master).filter((entry) => entry.kind === "project");
  assert.equal(projects.length, 2);
  assert.equal(projects[0].role, "Dungeon Quest");
  assert.equal(projects[0].employer, "Unity / C# / Multiplayer Game");
  // \href resolves to its label, not raw LaTeX.
  assert.equal(projects[0].location, "GitHub");
});

test("an ongoing entry has no end date rather than a fabricated one", () => {
  const ongoing = parseResumeEntries(master).find((entry) => entry.role === "Dungeon Quest")!;
  assert.equal(ongoing.startDate, "2025-01");
  assert.equal(ongoing.endDate, null);
});

test("dates normalize, and unparseable text yields null instead of a guess", () => {
  assert.equal(normalizeResumeDate("May 2025"), "2025-05");
  assert.equal(normalizeResumeDate("Sept. 2023"), "2023-09");
  assert.equal(normalizeResumeDate("Present"), null);
  assert.equal(normalizeResumeDate("sometime soon"), null);
  assert.equal(normalizeResumeDate("2024"), "2024");
  assert.deepEqual(splitDateRange("May 2025 -- Aug. 2025"), { start: "2025-05", end: "2025-08" });
  assert.deepEqual(splitDateRange("Jan. 2025 -- Present"), { start: "2025-01", end: null });
});

test("skills come from labelled skill lines only", () => {
  const skills = parseResumeSkills(master);
  for (const expected of ["Python", "PostgreSQL", "Docker", "React"]) {
    assert.ok(skills.includes(expected), `expected ${expected} in ${skills.join(", ")}`);
  }
  // Prose from bullets must not leak in as a skill.
  assert.ok(!skills.some((skill) => skill.includes("Developed")));
});

test("the bank autofills from the resume with per-entry skills", () => {
  const bank = resumeToExperienceBank(master);
  assert.ok(bank.length >= 5);
  const intern = bank.find((entry) => entry.role === "Software Developer Intern")!;
  assert.equal(intern.employer, "TechWorks Inc.");
  assert.equal(intern.bullets.length, 4);
  assert.equal(intern.source, "experience");
  // Only skills the entry's own bullets mention are attached.
  assert.ok(intern.skills.includes("Flask"));
  assert.ok(!intern.skills.includes("Unity"));
  // Ids are stable across runs so re-importing updates rather than duplicates.
  assert.deepEqual(bank.map((entry) => entry.id), resumeToExperienceBank(master).map((entry) => entry.id));
});

test("an entry with no bullets is not banked as empty evidence", () => {
  const source = [
    "\\documentclass{article}", "\\begin{document}", "\\section{Experience}",
    "\\resumeEntry{Acme}{Toronto}{Engineer}{May 2020 -- Jun 2021}",
    "\\end{document}",
  ].join("\n");
  assert.equal(parseResumeEntries(source).length, 1);
  assert.equal(resumeToExperienceBank(source).length, 0);
});
