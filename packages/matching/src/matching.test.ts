import assert from "node:assert/strict";
import { test } from "node:test";
import type { JobPosting } from "@ghostboard/shared";
import { calculateJobSimilarity, compareResumeToJob, extractJobKeywords, scoreJobSimilarity } from "./index";

function job(id: string, title: string, description: string, location = "Toronto", employmentType = "Full-time"): JobPosting {
  return {
    id,
    fingerprint: id,
    contentFingerprint: null,
    source: "fixture",
    sourceJobId: id,
    company: "Acme",
    title,
    location,
    jobUrl: `https://example.com/jobs/${id}`,
    jobDescription: description,
    employmentType,
    requirements: [],
    keywords: extractJobKeywords(description, { title }),
    postedAt: null,
    salaryRange: null,
    scrapedAt: "2026-09-11T00:00:00.000Z",
    workArrangement: null,
    applicationDeadline: null,
    startDate: null,
    termDuration: null,
    responsibilities: [],
    preferredQualifications: [],
    education: null,
    workAuthorization: null,
    clearance: null,
  };
}

test("keyword extraction canonicalizes aliases and ranks requirement terms", () => {
  const keywords = extractJobKeywords([
    "About the role", "Build APIs with Postgres and k8s.",
    "Requirements", "- PostgreSQL experience", "- Kubernetes and TypeScript", "- Docker and AWS",
  ].join("\n"), { title: "TypeScript Platform Engineer" });
  const names = keywords.map((keyword) => keyword.term);
  assert.ok(names.includes("PostgreSQL"));
  assert.ok(names.includes("Kubernetes"));
  assert.equal(keywords.find((keyword) => keyword.term === "PostgreSQL")?.occurrences, 2);
  assert.ok((keywords.find((keyword) => keyword.term === "TypeScript")?.score ?? 0) > 0.7);
});

test("Go is extracted as a language without matching ordinary prose", () => {
  assert.equal(extractJobKeywords("We go the extra mile and GO live safely.").some((item) => item.term === "Go"), false);
  assert.equal(extractJobKeywords("Backend services are written in Go and Rust.").some((item) => item.term === "Go"), true);
});

test("resume comparison is deterministic, weighted, and alias-aware", () => {
  const result = compareResumeToJob("TypeScript, React, Postgres", "Requirements\n- TypeScript and React\n- PostgreSQL\n- AWS and Docker");
  assert.deepEqual(result.matched.map((item) => item.keyword), ["PostgreSQL", "React", "TypeScript"]);
  assert.ok(result.missing.some((item) => item.keyword === "AWS"));
  assert.ok(result.overallScore > 0 && result.overallScore < 1);
});

test("similarity ranks a same-level platform job above an unrelated role and explains why", () => {
  const target = job("1", "Software Engineer Intern", "Build TypeScript React applications, Python REST APIs, PostgreSQL, Docker and CI/CD.", "Toronto", "Internship");
  const close = job("2", "Platform Engineering Intern", "Build Python REST APIs and TypeScript services using PostgreSQL, Docker, Kubernetes and CI/CD.", "Toronto", "Internship");
  const far = job("3", "Senior Sales Manager", "Lead enterprise sales, account planning, negotiation and revenue forecasting.", "Vancouver", "Full-time");
  const results = calculateJobSimilarity(target, [far, close]);
  assert.equal(results[0].similarJobId, "2");
  assert.ok(results[0].score > results[1].score);
  assert.ok(results[0].sharedKeywords.includes("TypeScript"));
  assert.ok(results[0].reasons.some((reason) => reason.startsWith("Shared:")));
  assert.ok(results[0].reasons.some((reason) => reason.includes("intern-level")));
});

test("pairwise similarity is symmetric and bounded", () => {
  const first = job("1", "Senior Backend Engineer", "Build TypeScript APIs with PostgreSQL and Docker.", "Remote", "Full-time");
  const second = job("2", "Senior Platform Engineer", "Build TypeScript services with PostgreSQL, Docker and Kubernetes.", "Remote", "FULL_TIME");
  const forward = scoreJobSimilarity(first, second);
  const reverse = scoreJobSimilarity(second, first);

  assert.equal(forward.score, reverse.score);
  assert.ok(forward.score >= 0 && forward.score <= 1);
  assert.deepEqual([...forward.sharedKeywords].sort(), [...reverse.sharedKeywords].sort());
  assert.equal(forward.jobId, first.id);
  assert.equal(forward.similarJobId, second.id);
});

test("pairwise similarity compares employment type without inventing seniority", () => {
  const target = job("1", "Software Engineer", "Build TypeScript APIs and PostgreSQL services.", "Toronto", "Full-time");
  const sameEmployment = job("2", "Software Engineer", "Build TypeScript APIs and PostgreSQL services.", "Toronto", "FULL_TIME");
  const differentEmployment = job("3", "Software Engineer", "Build TypeScript APIs and PostgreSQL services.", "Toronto", "Contract");
  const sameResult = scoreJobSimilarity(target, sameEmployment);
  const differentResult = scoreJobSimilarity(target, differentEmployment);

  assert.ok(sameResult.score > differentResult.score);
  assert.ok(sameResult.reasons.includes("Both full-time roles"));
  assert.ok(!sameResult.reasons.some((reason) => reason.includes("mid-level")));
});
