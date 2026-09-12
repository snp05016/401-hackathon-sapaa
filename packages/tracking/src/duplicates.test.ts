import assert from "node:assert/strict";
import { test } from "node:test";
import type { Application } from "@ghostboard/shared";
import { duplicateKey, findDuplicateApplications, isUniformSource, mixedSourceGroups, redundantApplicationIds } from "./duplicates";

function application(
  id: string,
  jobUrl: string,
  source = "LinkedIn",
  createdAt = "2026-09-01T00:00:00.000Z",
  description = `description for ${id}`,
  company = "Test company",
  title = "Developer",
  location: string | null = null,
): Application {
  return {
    id, company, title, location,
    jobUrl, jobDescription: description, status: "found",
	    dateFound: "2026-09-01", dateApplied: null, lastActivityAt: "2026-09-01",
	    followUpOn: false, followUpDismissedAt: null,
	    nextAction: null, nextActionDate: null, resumeId: null, source,
    createdAt, updatedAt: createdAt,
  };
}

test("identical job urls form a duplicate group", () => {
  const applications = [application("a", "https://www.linkedin.com/jobs/view/4461430151"),
    application("b", "https://www.linkedin.com/jobs/view/4461430151")];
  const groups = findDuplicateApplications(applications);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].applications.map((entry) => entry.id).sort(), ["a", "b"]);
});

test("linkedin tracking query params collapse onto the same duplicate key", () => {
  const plain = "https://www.linkedin.com/jobs/view/4461430151";
  const tracked = "https://www.linkedin.com/jobs/view/4461430151?alternateChannel=search&refId=JktGAPf%2F1LzbGerMpLkDWA%3D%3D";
  assert.equal(duplicateKey(plain), duplicateKey(tracked));
  assert.equal(findDuplicateApplications([application("a", plain), application("b", tracked)]).length, 1);
});

test("distinct linkedin postings stay separate", () => {
  const groups = findDuplicateApplications([
    application("a", "https://www.linkedin.com/jobs/view/4461430151", "LinkedIn", "2026-09-01T10:00:00.000Z", "Posting one.", "OPG", "Winter Co-Op"),
    application("b", "https://www.linkedin.com/jobs/view/4465098565", "LinkedIn", "2026-09-02T10:00:00.000Z", "Posting two.", "Sun Life", "API Developer"),
  ]);
  assert.equal(groups.length, 0);
});

test("host, path case, and trailing slashes are normalized", () => {
  assert.equal(duplicateKey("HTTPS://Www.LinkedIn.com/Jobs/View/4461430151/"), duplicateKey("https://www.linkedin.com/jobs/view/4461430151"));
  assert.equal(duplicateKey("https://boards.greenhouse.io/opg/"), duplicateKey("https://boards.greenhouse.io/opg"));
});

test("indeed job ids live in the query string and must not be dropped", () => {
  assert.notEqual(
    duplicateKey("https://www.indeed.com/viewjob?jk=abc123"),
    duplicateKey("https://www.indeed.com/viewjob?jk=def456"),
  );
  assert.equal(duplicateKey("https://www.indeed.com/viewjob?jk=abc123"), duplicateKey("https://www.indeed.com/viewjob?jk=abc123"));
});

test("unparseable urls fall back to trimmed lowercase matching", () => {
  assert.equal(duplicateKey("  NOT-A-URL "), duplicateKey("not-a-url"));
});

test("single, duplicated, and multi-copy rows are grouped deterministically", () => {
  const applications = [
    application("a", "https://www.linkedin.com/jobs/view/4461430151"),
    application("b", "https://www.linkedin.com/jobs/view/4461430151"),
    application("c", "https://www.linkedin.com/jobs/view/4465098565"),
    application("d", "https://www.linkedin.com/jobs/view/4465098565"),
    application("e", "https://www.linkedin.com/jobs/view/4465098565"),
    application("f", "https://www.linkedin.com/jobs/view/4454576972"),
  ];
  const groups = findDuplicateApplications(applications);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].applications.length, 2);
  assert.equal(groups[1].applications.length, 3);
  assert.equal(findDuplicateApplications([]).length, 0);
});

test("same-source duplicates only flag the extra copies, keeping the earliest", () => {
  const applications = [
    application("a", "https://www.linkedin.com/jobs/view/4461430151", "LinkedIn", "2026-09-01T10:00:00.000Z"),
    application("b", "https://www.linkedin.com/jobs/view/4461430151", "LinkedIn", "2026-09-02T10:00:00.000Z"),
    application("c", "https://www.linkedin.com/jobs/view/4465098565", "LinkedIn", "2026-09-03T10:00:00.000Z"),
  ];
  assert.deepEqual(redundantApplicationIds(applications).sort(), ["b"]);
  assert.equal(isUniformSource(findDuplicateApplications(applications)[0]), true);
  assert.equal(mixedSourceGroups(applications).length, 0);
});

test("cross-site duplicates are never auto-removed and surface as mixed-source groups", () => {
  const description = "Build reliable backend services for the winter term.";
  const applications = [
    application("a", "https://www.linkedin.com/jobs/view/4461430151", "LinkedIn", "2026-09-01T10:00:00.000Z", description),
    application("b", "https://boards.greenhouse.io/acme/jobs/4461430151", "Greenhouse", "2026-09-02T10:00:00.000Z", description),
  ];
  assert.deepEqual(redundantApplicationIds(applications), []);
  const mixed = mixedSourceGroups(applications);
  assert.equal(mixed.length, 1);
  assert.deepEqual(new Set(mixed[0].applications.map((entry) => entry.source)), new Set(["LinkedIn", "Greenhouse"]));
});

test("mixed-source duplicates also unify across linkedin and greenhouse for the same posting", () => {
  const description = "Internship opening for the API platform team.";
  const applications = [
    application("a", "https://www.linkedin.com/jobs/view/4465098565", "LinkedIn", "2026-09-01T10:00:00.000Z", description),
    application("b", "https://boards.greenhouse.io/sunlife/jobs/4465098565", "Greenhouse", "2026-09-02T10:00:00.000Z", description),
    application("c", "https://www.linkedin.com/jobs/view/4454576972", "LinkedIn", "2026-09-03T10:00:00.000Z", "Software Developer at a different firm."),
  ];
  const groups = findDuplicateApplications(applications);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].applications.length, 2);
  assert.deepEqual(new Set(groups[0].applications.map((entry) => entry.source)), new Set(["LinkedIn", "Greenhouse"]));
});

test("distinct postings with their own content stay separate when names differ", () => {
  const applications = [
    application("a", "https://www.linkedin.com/jobs/view/4461430151", "LinkedIn", "2026-09-01T10:00:00.000Z", "Ontario power generation winter co-op.", "OPG", "Winter Co-Op"),
    application("b", "https://www.linkedin.com/jobs/view/4465098565", "LinkedIn", "2026-09-02T10:00:00.000Z", "Sun Life API developer internship.", "Sun Life", "API Developer"),
  ];
  assert.equal(findDuplicateApplications(applications).length, 0);
});

test("same posting on different sites merges by name when only two copies share it", () => {
  const applications = [
    application("a", "https://www.linkedin.com/jobs/view/4461430151", "LinkedIn", "2026-09-01T10:00:00.000Z", "Winter co-op text on LinkedIn.", "OPG", "Winter 2027 Co-Op"),
    application("b", "https://jobs.lever.co/opg/4461430151", "Lever", "2026-09-02T10:00:00.000Z", "Winter co-op text on the lever board.", "OPG", "Winter 2027 Co-Op"),
  ];
  const group = findDuplicateApplications(applications);
  assert.equal(group.length, 1);
  assert.equal(group[0].applications.length, 2);
  assert.equal(mixedSourceGroups(applications).length, 1);
  assert.deepEqual(redundantApplicationIds(applications), []);
});

test("name matching is skipped when more than two copies share the name", () => {
  const applications = [
    application("a", "https://www.linkedin.com/jobs/view/4461430151", "LinkedIn", "2026-09-01T10:00:00.000Z", "First posting text."),
    application("b", "https://jobs.lever.co/acme/4461430151", "Lever", "2026-09-02T10:00:00.000Z", "Second posting text."),
    application("c", "https://boards.greenhouse.io/acme/jobs/4461430151", "Greenhouse", "2026-09-03T10:00:00.000Z", "Third posting text."),
  ];
  assert.equal(findDuplicateApplications(applications).length, 0);
  assert.equal(redundantApplicationIds(applications).length, 0);
});

test("identical names at different locations are distinct postings", () => {
  const applications = [
    application("a", "https://www.linkedin.com/jobs/view/4461430151", "LinkedIn", "2026-09-01T10:00:00.000Z", "Edmonton posting.", "ACME", "Software Developer", "Edmonton, AB"),
    application("b", "https://jobs.lever.co/acme/4461430151", "Lever", "2026-09-02T10:00:00.000Z", "Toronto posting.", "ACME", "Software Developer", "Toronto, ON"),
  ];
  assert.equal(findDuplicateApplications(applications).length, 0);
});
