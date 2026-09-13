import assert from "node:assert/strict";
import { test } from "node:test";
import { flagUnsupported, proposeBulletRewrites } from "./proposeBullets";

test("a named technology absent from the original bullet is flagged", () => {
  assert.equal(
    flagUnsupported(
      "Designed and optimized SQL queries, reducing average database response time by 30%.",
      "Optimized SQL queries for PostgreSQL, reducing average database response time by 30%.",
    ),
    true,
  );
  assert.equal(flagUnsupported("Built internal tools.", "Built internal tools with Kubernetes."), true);
});

test("rephrasing without a new claim is not flagged", () => {
  assert.equal(
    flagUnsupported(
      "Developed REST APIs using Python and Flask to support internal applications used by 200+ employees.",
      "Designed and implemented backend REST APIs in Python/Flask for internal applications serving 200+ employees.",
    ),
    false,
  );
  assert.equal(
    flagUnsupported(
      "Built automated unit tests that increased backend test coverage from 65% to 88%.",
      "Implemented automated unit tests, raising backend test coverage from 65% to 88%.",
    ),
    false,
  );
  assert.equal(
    flagUnsupported(
      "Collaborated with a team of 6 developers using Git, code reviews, and Agile development practices.",
      "Collaborated with a 6-developer team using Git, code reviews, and Agile practices.",
    ),
    false,
  );
});

test("trailing sentence punctuation does not make a known term look new", () => {
  assert.equal(
    flagUnsupported(
      "Implemented backend features for a customer management platform using Java and PostgreSQL.",
      "Implemented backend features for a customer management platform with Java and PostgreSQL.",
    ),
    false,
  );
});

test("proposals map back to bullet ids and drop no-ops", async () => {
  const master = [
    "\\documentclass{article}", "\\begin{document}", "\\section{Experience}", "\\begin{itemize}",
    "    \\item Developed REST APIs using Python.",
    "    \\item Wrote unit tests for the billing service.",
    "\\end{itemize}", "\\end{document}",
  ].join("\n");
  const provider = {
    async complete() {
      return {
        text: '{"proposals":[{"n":1,"after":"Built REST APIs in Python.","rationale":"match stack"},'
          + '{"n":2,"after":"Wrote unit tests for the billing service.","rationale":"no change"},'
          + '{"n":9,"after":"out of range","rationale":"bad"}]}',
        provider: "stub", model: "stub",
      };
    },
  };
  const { proposals, warnings } = await proposeBulletRewrites(master, "Python backend role", { provider });
  assert.deepEqual(warnings, []);
  // The unchanged bullet and the out-of-range index are both dropped.
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].id, "b0");
  assert.equal(proposals[0].after, "Built REST APIs in Python.");
  assert.deepEqual(proposals[0].evidence, []);
  assert.equal(proposals[0].replacementSource, "master");
});

test("a cited experience-bank capability is supported", async () => {
  const master = "\\documentclass{article}\\begin{document}\\begin{itemize}\\item Optimized SQL queries for internal reporting.\\end{itemize}\\end{document}";
  const provider = {
    async complete() {
      return {
        text: JSON.stringify({
          proposals: [{
            n: 1,
            after: "Optimized SQL queries for PostgreSQL-backed internal reporting.",
            rationale: "Names relevant database experience",
            evidenceRefs: ["bank:role-1:0"],
          }],
        }),
        provider: "stub",
        model: "stub",
      };
    },
  };
  const result = await proposeBulletRewrites(master, "PostgreSQL reporting role", {
    provider,
    experienceBank: [{
      id: "role-1",
      role: "Backend Engineer",
      employer: "Example Co",
      startDate: null,
      endDate: null,
      bullets: ["Built reporting services backed by PostgreSQL."],
      skills: ["PostgreSQL"],
    }],
  });
  assert.equal(result.proposals[0].unsupported, false);
  assert.equal(result.proposals[0].evidence[0].ref, "bank:role-1:0");
  assert.equal(result.proposals[0].evidence[0].text, "Built reporting services backed by PostgreSQL.");
  assert.deepEqual(result.warnings, []);
});

test("an uncited bank capability remains flagged", async () => {
  const master = "\\documentclass{article}\\begin{document}\\begin{itemize}\\item Optimized SQL queries for internal reporting.\\end{itemize}\\end{document}";
  const provider = {
    async complete() {
      return {
        text: '{"proposals":[{"n":1,"after":"Optimized SQL queries for PostgreSQL-backed internal reporting."}]}',
        provider: "stub",
        model: "stub",
      };
    },
  };
  const result = await proposeBulletRewrites(master, "PostgreSQL reporting role", {
    provider,
    experienceBank: [{
      id: "role-1",
      role: "Backend Engineer",
      employer: "Example Co",
      startDate: null,
      endDate: null,
      bullets: ["Built reporting services backed by PostgreSQL."],
      skills: [],
    }],
  });
  assert.equal(result.proposals[0].unsupported, true);
  assert.deepEqual(result.proposals[0].evidence, []);
});

test("an experience-bank reference can replace the current bullet", async () => {
  const master = "\\documentclass{article}\\begin{document}\\begin{itemize}\\item Maintained internal dashboards.\\end{itemize}\\end{document}";
  const provider = {
    async complete() {
      return {
        text: '{"proposals":[{"n":1,"bankRef":"bank:role-2:0","rationale":"More relevant evidence"}]}',
        provider: "stub",
        model: "stub",
      };
    },
  };
  const result = await proposeBulletRewrites(master, "Data platform role", {
    provider,
    experienceBank: [{
      id: "role-2",
      role: "Data Engineer",
      employer: "Example Co",
      startDate: null,
      endDate: null,
      bullets: ["Built data pipelines processing 2M records daily."],
      skills: ["SQL"],
    }],
  });
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].after, "Built data pipelines processing 2M records daily.");
  assert.equal(result.proposals[0].replacementSource, "experience-bank");
  assert.equal(result.proposals[0].unsupported, false);
  assert.equal(result.proposals[0].evidence[0].ref, "bank:role-2:0");
});

test("invalid bank references are ignored and reported", async () => {
  const master = "\\documentclass{article}\\begin{document}\\begin{itemize}\\item Maintained internal dashboards.\\end{itemize}\\end{document}";
  const provider = {
    async complete() {
      return {
        text: '{"proposals":[{"n":1,"after":"Maintained dashboards with Kubernetes.","evidenceRefs":["bank:missing:0"],"bankRef":"bank:missing:0"}]}',
        provider: "stub",
        model: "stub",
      };
    },
  };
  const result = await proposeBulletRewrites(master, "Platform role", {
    provider,
    experienceBank: [{
      id: "role-3",
      role: "Engineer",
      employer: "Example Co",
      startDate: null,
      endDate: null,
      bullets: ["Maintained internal dashboards."],
      skills: [],
    }],
  });
  assert.equal(result.proposals[0].unsupported, true);
  assert.deepEqual(result.proposals[0].evidence, []);
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings[0], /not available/);
});

test("a provider failure degrades to a warning rather than throwing", async () => {
  const master = "\\documentclass{article}\\begin{document}\\begin{itemize}\\item A bullet here.\\end{itemize}\\end{document}";
  const provider = { async complete() { throw new Error("groq is down"); } };
  const { proposals, warnings } = await proposeBulletRewrites(master, "some job", { provider });
  assert.deepEqual(proposals, []);
  assert.match(warnings[0], /groq is down/);
});

test("an empty job description is refused", async () => {
  await assert.rejects(proposeBulletRewrites("\\documentclass{article}", "  ", { provider: { async complete() { return { text: "", provider: "s", model: "s" }; } } }), /job description is required/);
});
