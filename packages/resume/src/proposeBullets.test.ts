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
