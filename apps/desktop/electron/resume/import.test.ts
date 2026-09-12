import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mergeImportedExperienceEntries } from "./import";
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

  test("preserves existing order and appends accepted", () => {
    const existing = [
      makeEntry({ id: "1", role: "A", employer: "A" }),
      makeEntry({ id: "2", role: "B", employer: "B" }),
    ];
    const proposed = [makeEntry({ id: "3", role: "C", employer: "C" })];
    const result = mergeImportedExperienceEntries(existing, proposed);
    assert.equal(result.length, 3);
    assert.equal(result[0].id, "1");
    assert.equal(result[1].id, "2");
    assert.equal(result[2].id, "3");
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
});