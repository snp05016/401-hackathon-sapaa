import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mergeImportedExperienceEntries, orderExperienceEntries } from "./import";
import type { ExperienceEntry } from "@ghostboard/shared";

function makeEntry(overrides: Partial<ExperienceEntry> = {}): ExperienceEntry {
  return {
    id: "test-id",
    role: "Test Role",
    employer: "Test Employer",
    startDate: "2022-01-01",
    endDate: "2023-01-01",
    bullets: ["Bullet 1"],
    skills: ["Skill 1"],
    source: "experience",
    ...overrides,
  };
}

describe("mergeImportedExperienceEntries", () => {
  test("deduplicates case-insensitive role+employer against existing", () => {
    const existing = [makeEntry({ id: "1", role: "Engineer", employer: "Acme" })];
    const proposed = [makeEntry({ id: "2", role: "engineer", employer: "acme" })];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "1");
  });

  test("deduplicates case-insensitive role+employer within proposed", () => {
    const existing: ExperienceEntry[] = [];
    const proposed = [
      makeEntry({ id: "1", role: "Engineer", employer: "Acme" }),
      makeEntry({ id: "2", role: "engineer", employer: "acme" }),
    ];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "1");
  });

  test("skips proposal with both empty role and employer", () => {
    const existing: ExperienceEntry[] = [];
    const proposed = [makeEntry({ id: "1", role: "", employer: "" })];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.deepEqual(result, []);
  });

  test("skips proposal with role > 200 chars", () => {
    const existing: ExperienceEntry[] = [];
    const proposed = [makeEntry({ id: "1", role: "x".repeat(201), employer: "Acme" })];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.deepEqual(result, []);
  });

  test("skips proposal with employer > 200 chars", () => {
    const existing: ExperienceEntry[] = [];
    const proposed = [makeEntry({ id: "1", role: "Engineer", employer: "x".repeat(201) })];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.deepEqual(result, []);
  });

  test("preserves the parsed source category", () => {
    const existing: ExperienceEntry[] = [];
    const proposed = [makeEntry({ id: "1", source: "project" })];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.equal(result[0].source, "project");
  });

  test("replaces stale per-category skill rows with the freshly parsed flat skill entry", () => {
    const existing: ExperienceEntry[] = [
      makeEntry({ id: "1", role: "Software", employer: "Skills", source: "skill", skills: ["Java", "C#/C/C++"] }),
      makeEntry({ id: "2", role: "Languages", employer: "Skills", source: "skill", skills: ["English", "Cantonese"] }),
    ];
    const proposed = [makeEntry({ id: "9", role: "Technical Skills", employer: "Skills", source: "skill", skills: ["Java", "Python", "SQL"] })];
    const result = mergeImportedExperienceEntries(existing, proposed);
    const skillRows = result.filter((entry) => entry.source === "skill");
    assert.equal(skillRows.length, 1);
    assert.equal(skillRows[0].role, "Technical Skills");
    assert.deepEqual(skillRows[0].skills, ["Java", "Python", "SQL"]);
    assert.ok(!skillRows[0].skills.includes("C#/C/C++"));
  });

  test("refreshes the flat skill entry in place across re-saves instead of duplicating it", () => {
    const existing: ExperienceEntry[] = [
      makeEntry({ id: "keep", role: "Technical Skills", employer: "Skills", source: "skill", skills: ["C++"] }),
      makeEntry({ id: "2", role: "Software Developer", employer: "Acme", source: "experience" }),
    ];
    const proposed = [makeEntry({ id: "new", role: "Technical Skills", employer: "Skills", source: "skill", skills: ["Java", "SQL"] })];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.equal(result.length, 2);
    const skillRow = result.find((entry) => entry.source === "skill");
    assert.equal(skillRow?.id, "keep");
    assert.deepEqual(skillRow?.skills, ["Java", "SQL"]);
    assert.ok(result.find((entry) => entry.id === "2"));
  });

  test("leaves existing skill rows untouched when the resume declares no skills", () => {
    const existing = [makeEntry({ id: "1", role: "Software", employer: "Skills", source: "skill", skills: ["Java"] })];
    const proposed: ExperienceEntry[] = [];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "1");
    assert.deepEqual(result[0].skills, ["Java"]);
  });

  test("refreshes matching existing entries with the newest resume content but keeps their id", () => {
    const existing = [makeEntry({ id: "1", role: "Engineer", employer: "Acme", bullets: ["Old bullet"], startDate: "2021-01-01" })];
    const proposed = [makeEntry({ id: "9", role: "engineer", employer: "acme", bullets: ["Newest bullet", "Edited bullet"], startDate: "2022-06-15", skills: ["New Skill"] })];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "1");
    assert.deepEqual(result[0].bullets, ["Newest bullet", "Edited bullet"]);
    assert.equal(result[0].startDate, "2022-06-15");
    assert.deepEqual(result[0].skills, ["New Skill"]);
  });

  test("drops non-skill rows the re-saved resume no longer declares", () => {
    const existing = [
      makeEntry({ id: "1", role: "Engineer", employer: "Acme", bullets: ["Old bullet"] }),
      makeEntry({ id: "2", role: "Volunteer", employer: "Local Shelter", source: "volunteer" }),
    ];
    const proposed = [makeEntry({ id: "9", role: "Engineer", employer: "Acme", bullets: ["Newest bullet"] })];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "1");
    assert.deepEqual(result[0].bullets, ["Newest bullet"]);
  });

  test("keeps existing rows the resume still declares and appends accepted in order", () => {
    const existing = [
      makeEntry({ id: "1", role: "A", employer: "A" }),
      makeEntry({ id: "2", role: "B", employer: "B" }),
    ];
    const proposed = [
      makeEntry({ id: "1a", role: "A", employer: "A" }),
      makeEntry({ id: "2b", role: "B", employer: "B" }),
      makeEntry({ id: "3", role: "C", employer: "C" }),
    ];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.equal(result.length, 3);
    assert.equal(result[0].id, "1");
    assert.equal(result[1].id, "2");
    assert.equal(result[2].id, "3");
  });

  test("drops experience and project rows the re-saved resume no longer declares while keeping skill rows", () => {
    const existing = [
      makeEntry({ id: "1", role: "Engineer", employer: "Acme", source: "experience" }),
      makeEntry({ id: "2", role: "Portfolio Site", employer: "Project", source: "project" }),
      makeEntry({ id: "3", role: "Technical Skills", employer: "Skills", source: "skill", skills: ["Java"] }),
    ];
    const proposed = [
      makeEntry({ id: "9", role: "Engineer", employer: "Acme", source: "experience" }),
      makeEntry({ id: "11", role: "Technical Skills", employer: "Skills", source: "skill", skills: ["Java"] }),
    ];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.equal(result.length, 2);
    assert.equal(result[0].id, "1");
    assert.equal(result[1].id, "3");
  });

  test("keeps non-skill rows untouched when the resume parses no non-skill entries", () => {
    const existing = [makeEntry({ id: "1", role: "Engineer", employer: "Acme" })];
    const proposed: ExperienceEntry[] = [];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "1");
  });

  test("handles empty arrays", () => {
    assert.deepEqual(mergeImportedExperienceEntries([], []), []);
    assert.deepEqual(mergeImportedExperienceEntries([makeEntry({ id: "1" })], []), [makeEntry({ id: "1" })]);
    assert.deepEqual(mergeImportedExperienceEntries([], [makeEntry({ id: "1" })]), [makeEntry({ id: "1", source: "experience" })]);
  });

  test("caps accepted at 200 per call", () => {
    const existing: ExperienceEntry[] = [];
    const proposed = Array.from({ length: 250 }, (_, i) => makeEntry({ id: String(i), role: `Role ${i}`, employer: `Co ${i}` }));
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.equal(result.length, 200);
  });

  test("fills skills with empty array if missing", () => {
    const existing: ExperienceEntry[] = [];
    const proposed = [{ ...makeEntry({ id: "1" }), skills: undefined as unknown as string[] }];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.deepEqual(result[0].skills, []);
  });

  test("passes through startDate and endDate", () => {
    const existing: ExperienceEntry[] = [];
    const proposed = [makeEntry({ id: "1", startDate: "2020-06-15", endDate: null })];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.equal(result[0].startDate, "2020-06-15");
    assert.equal(result[0].endDate, null);
  });

  test("orders the merged bank as jobs, then projects, then skills", () => {
    const existing = [
      makeEntry({ id: "skill-1", role: "Technical Skills", employer: "Skills", source: "skill", skills: ["Java"] }),
      makeEntry({ id: "proj-1", role: "Portfolio Site", employer: "Project", source: "project" }),
      makeEntry({ id: "job-1", role: "Engineer", employer: "Acme", source: "experience" }),
    ];
    const proposed = [
      makeEntry({ id: "job-1", role: "Engineer", employer: "Acme", source: "experience" }),
      makeEntry({ id: "job-2", role: "Intern", employer: "Acme", source: "experience" }),
      makeEntry({ id: "proj-1", role: "Portfolio Site", employer: "Project", source: "project" }),
      makeEntry({ id: "proj-2", role: "CLI Tool", employer: "Project", source: "project" }),
      makeEntry({ id: "skill-1", role: "Technical Skills", employer: "Skills", source: "skill", skills: ["Java"] }),
      makeEntry({ id: "skill-2", role: "Languages", employer: "Skills", source: "skill", skills: ["English"] }),
    ];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.deepEqual(
      result.map((entry) => entry.id),
      ["job-1", "job-2", "proj-1", "proj-2", "skill-1", "skill-2"],
    );
  });

  test("keeps a refreshed entry in place instead of moving it to the bottom", () => {
    const existing = [
      makeEntry({ id: "job-1", role: "Engineer", employer: "Acme", source: "experience", bullets: ["Old bullet"] }),
      makeEntry({ id: "skill-1", role: "Technical Skills", employer: "Skills", source: "skill", skills: ["Java"] }),
      makeEntry({ id: "proj-1", role: "Portfolio Site", employer: "Project", source: "project" }),
    ];
    const proposed = [
      makeEntry({ id: "9", role: "Engineer", employer: "Acme", source: "experience", bullets: ["Newest bullet"] }),
      makeEntry({ id: "12", role: "Portfolio Site", employer: "Project", source: "project" }),
      makeEntry({ id: "15", role: "Technical Skills", employer: "Skills", source: "skill", skills: ["Java"] }),
    ];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.deepEqual(
      result.map((entry) => entry.id),
      ["job-1", "proj-1", "skill-1"],
    );
    assert.deepEqual(result[0].bullets, ["Newest bullet"]);
  });

  test("orderExperienceEntries keeps relative order within each source" +
    " and defaults missing source to job experience", () => {
    const ordered = orderExperienceEntries([
      makeEntry({ id: "s", role: "Skills", employer: "Skills", source: "skill" }),
      makeEntry({ id: "b", role: "Role B", employer: "Co" }),
      makeEntry({ id: "a", role: "Role A", employer: "Co" }),
      makeEntry({ id: "p", role: "Proj", employer: "Project", source: "project" }),
    ]);
    assert.deepEqual(
      ordered.map((entry) => entry.id),
      ["b", "a", "p", "s"],
    );
  });
});