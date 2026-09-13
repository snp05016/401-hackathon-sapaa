import assert from "node:assert/strict";
import { test } from "node:test";
import type { CompletionRequest } from "@ghostboard/ai";
import { customizeResume } from "./customizeResume";

function validMaster(): string {
  return [
    "\\documentclass{article}",
    "\\begin{document}",
    "\\section{Experience}",
    "Software engineer at Acme from 2021 to 2024 building web services with TypeScript.",
    "\\end{document}",
  ].join("\n");
}

function validTailored(): string {
  return [
    "\\documentclass{article}",
    "\\begin{document}",
    "\\section{Experience}",
    "Backend engineer at Acme from 2021 to 2024 building web services with TypeScript.",
    "\\end{document}",
  ].join("\n");
}

function fenced(latex: string): string {
  return "```latex\n" + latex + "\n```";
}

function mockProvider(text: string) {
  return {
    complete: async (): Promise<{ text: string; provider: string; model: string }> => ({
      text,
      provider: "mock",
      model: "mock",
    }),
  };
}

test("customizeResume returns LaTeX and a diff summary from a valid fenced model response", async () => {
  const result = await customizeResume(
    { masterLatex: validMaster(), jobDescription: "Build backend services." },
    { provider: mockProvider(fenced(validTailored())) },
  );
  assert.equal(result.latex, validTailored());
  assert.ok(Array.isArray(result.changesSummary));
  assert.ok(result.changesSummary.length > 0);
});

test("customizeResume rejects invalid LaTeX from the model", async () => {
  await assert.rejects(
    customizeResume(
      { masterLatex: validMaster(), jobDescription: "Build backend services." },
      { provider: mockProvider("this is not latex") },
    ),
    /did not return a valid LaTeX document/,
  );
});

test("customizeResume rejects an empty job description before calling the model", async () => {
  let called = false;
  const provider = {
    complete: async (): Promise<{ text: string; provider: string; model: string }> => {
      called = true;
      return { text: fenced(validTailored()), provider: "mock", model: "mock" };
    },
  };
  await assert.rejects(
    customizeResume({ masterLatex: validMaster(), jobDescription: "   " }, { provider }),
    /job description is required/i,
  );
  assert.equal(called, false);
});

test("customizeResume rejects an oversized experience bank before calling the model", async () => {
  const bank = Array.from({ length: 201 }, (_, index) => ({
    id: String(index),
    role: "Engineer",
    employer: "Acme",
    startDate: null,
    endDate: null,
    bullets: ["Built software."],
    skills: [],
  }));
  await assert.rejects(
    customizeResume({ masterLatex: validMaster(), jobDescription: "Build backend services.", experienceBank: bank }, { provider: mockProvider("") }),
    /experience bank/i,
  );
});

test("customizeResume rejects oversized job context fields before calling the model", async () => {
  let called = false;
  const provider = {
    complete: async (): Promise<{ text: string; provider: string; model: string }> => {
      called = true;
      return { text: fenced(validTailored()), provider: "mock", model: "mock" };
    },
  };
  await assert.rejects(
    customizeResume(
      { masterLatex: validMaster(), jobDescription: "Build backend services.", jobContext: { company: "A".repeat(2001) } },
      { provider },
    ),
    /too large/i,
  );
  await assert.rejects(
    customizeResume(
      { masterLatex: validMaster(), jobDescription: "Build backend services.", jobContext: { jobUrl: "https://example.com/" + "x".repeat(2000) } },
      { provider },
    ),
    /too large/i,
  );
  assert.equal(called, false);
});

test("customizeResume rejects an oversized candidate profile before calling the model", async () => {
  await assert.rejects(
    customizeResume(
      {
        masterLatex: validMaster(),
        jobDescription: "Build backend services.",
        candidateProfile: {
          id: "local",
          updatedAt: "2026-01-01T00:00:00.000Z",
          fields: Array.from({ length: 501 }, (_, index) => ({ key: String(index), label: "Field", value: "x", category: "custom" })),
        },
      },
      { provider: mockProvider("") },
    ),
    /candidate profile/i,
  );
});

test("the tailoring prompt encodes resume-surgeon constraints and job context", async () => {
  let capturedMessages: CompletionRequest["messages"] = [];
  const provider = {
    complete: async (request: CompletionRequest) => {
      capturedMessages = request.messages;
      return { text: fenced(validTailored()), provider: "mock", model: "mock" };
    },
  };
  await customizeResume(
    {
      masterLatex: validMaster(),
      jobDescription: "Build backend services for a large customer base.",
      jobContext: { company: "Acme Corp", title: "Senior Backend Engineer", jobUrl: "https://acme.example/jobs/1" },
    },
    { provider },
  );
  assert.equal(capturedMessages.length, 2);
  assert.equal(capturedMessages[0]?.role, "system");
  assert.equal(capturedMessages[1]?.role, "user");
  const combined = `${capturedMessages[0]?.content ?? ""}\n${capturedMessages[1]?.content ?? ""}`;
  const lower = combined.toLowerCase();
  assert.ok(lower.includes("never invent"), "prompt must forbid inventing facts");
  assert.ok(lower.includes("minimum_required"), "prompt must minimize cloud context");
  assert.ok(lower.includes("acme corp"), "prompt must include the job company");
  assert.ok(lower.includes("senior backend engineer"), "prompt must include the job title");
  assert.ok(combined.includes("<MASTER_LATEX>"));
  assert.ok(combined.includes("<JOB_DESCRIPTION>"));
  assert.ok(combined.includes("<CANDIDATE_PROFILE>"));
  assert.ok(combined.includes("<EVIDENCE_RECORDS>"));
  assert.ok(combined.includes("<TAILORING_PREFERENCES>"));
});

test("customizeResume never mutates the master resume and returns a separate document", async () => {
  const master = validMaster();
  const snapshot = master;
  const result = await customizeResume(
    { masterLatex: master, jobDescription: "Build backend services." },
    { provider: mockProvider(fenced(validTailored())) },
  );
  assert.equal(master, snapshot);
  assert.notEqual(result.latex, master);
});

test("customizeResume preserves all content outside Experience exactly", async () => {
  const master = [
    "\\documentclass{article}",
    "\\begin{document}",
    "Ada Lovelace | ada@example.com | Edmonton, AB",
    "\\section{Experience}",
    "Software engineer at Acme.",
    "\\section{Education}",
    "University of Alberta",
    "\\end{document}",
  ].join("\n");
  const candidate = [
    "\\documentclass{article}",
    "\\begin{document}",
    "Wrong Name | changed@example.com",
    "\\section{Experience}",
    "Backend engineer at Acme.",
    "\\section{Education}",
    "Changed University",
    "\\end{document}",
  ].join("\n");
  const result = await customizeResume(
    { masterLatex: master, jobDescription: "Build backend services." },
    { provider: mockProvider(candidate) },
  );
  assert.equal(result.latex, master.replace("Software engineer at Acme.", "Backend engineer at Acme."));
  assert.match(result.latex, /Ada Lovelace \| ada@example\.com \| Edmonton, AB/);
  assert.match(result.latex, /University of Alberta/);
  assert.doesNotMatch(result.latex, /Wrong Name|changed@example\.com|Changed University/);
});
