import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { ExperienceEntry } from "@ghostboard/shared";
import {
  applyBulletSwapSuggestions,
  compatibleBulletListIndexes,
  insertBankBullet,
  parseExperienceBankText,
  rankExperienceBullets,
  suggestBulletSwaps,
} from "./experienceBank";

const MASTER = String.raw`\documentclass{article}
\begin{document}
\section{Experience}
\textbf{Engineer at Acme}
\begin{itemize}
  \item Helped with internal software.
  \item Wrote documentation.
\end{itemize}
\end{document}`;

function entry(overrides: Partial<ExperienceEntry> = {}): ExperienceEntry {
  return {
    id: "bank-1",
    role: "Engineer",
    employer: "Acme",
    startDate: null,
    endDate: null,
    bullets: ["Built TypeScript APIs that reduced processing time by 40%."],
    skills: ["TypeScript", "APIs"],
    source: "experience",
    ...overrides,
  };
}

describe("parseExperienceBankText", () => {
  test("parses Markdown roles, metadata, skills, dates, and bullets", () => {
    const parsed = parseExperienceBankText(`
## Senior Engineer | Acme
Dates: Jan 2022 - Present
Skills: TypeScript, PostgreSQL
- Built a TypeScript API.
- Cut latency by 40%.

## Launch project — Community Lab
Role: Project lead
* Coordinated 12 contributors.
`, "achievements.md");
    assert.equal(parsed.length, 2);
    assert.deepEqual(parsed[0], {
      role: "Senior Engineer",
      employer: "Acme",
      startDate: "2022-01-01",
      endDate: null,
      bullets: ["Built a TypeScript API.", "Cut latency by 40%."],
      skills: ["TypeScript", "PostgreSQL"],
      source: "experience",
    });
    assert.equal(parsed[1].role, "Project lead");
    assert.equal(parsed[1].employer, "Community Lab");
    assert.deepEqual(parsed[1].bullets, ["Coordinated 12 contributors."]);
  });

  test("puts loose plain-text bullets under the file name", () => {
    const parsed = parseExperienceBankText("- Led discovery interviews\n- Presented findings", "research-notes.txt");
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].role, "research-notes");
    assert.equal(parsed[0].employer, "Resume bank");
    assert.equal(parsed[0].bullets.length, 2);
  });

  test("preserves H1 and plain-text ownership headings", () => {
    const markdown = parseExperienceBankText("# Senior Engineer | Acme\n- Built APIs\n\n# Designer | Beta\n- Shipped prototypes", "bank.md");
    assert.deepEqual(markdown.map(({ role, employer }) => ({ role, employer })), [
      { role: "Senior Engineer", employer: "Acme" },
      { role: "Designer", employer: "Beta" },
    ]);
    const text = parseExperienceBankText("Engineer at Acme\n- Built services\n\nDesigner at Beta\n- Ran research", "bank.txt");
    assert.deepEqual(text.map(({ role, employer }) => ({ role, employer })), [
      { role: "Engineer", employer: "Acme" },
      { role: "Designer", employer: "Beta" },
    ]);
  });

  test("returns no entries for empty or bullet-free input", () => {
    assert.deepEqual(parseExperienceBankText(""), []);
    assert.deepEqual(parseExperienceBankText("## Engineer\nNo list items here"), []);
  });
});

describe("experience-bank relevance", () => {
  test("ranks matching evidence above unrelated evidence with stable normalized scores", () => {
    const ranked = rankExperienceBullets([
      entry(),
      entry({ id: "bank-2", role: "Writer", bullets: ["Edited a weekly newsletter."], skills: [] }),
    ], "Build TypeScript APIs and improve processing performance");
    assert.equal(ranked[0].entryId, "bank-1");
    assert.equal(ranked[0].score, 100);
    assert.ok(ranked[0].matchedTerms.includes("typescript"));
    assert.equal(ranked[1].score, 0);
  });

  test("proposes higher-fit bank bullets for lower-fit resume bullets", () => {
    const suggestions = suggestBulletSwaps(MASTER, [entry()], "TypeScript API performance processing");
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].bullet, entry().bullets[0]);
    assert.ok(suggestions[0].scoreGain > 0);
  });

  test("only treats bank bullets as compatible with a matching resume owner", () => {
    assert.deepEqual(compatibleBulletListIndexes(MASTER, { role: "Engineer", employer: "Acme" }), [0]);
    assert.deepEqual(compatibleBulletListIndexes(MASTER, { role: "Designer", employer: "Other Co" }), []);
    assert.deepEqual(suggestBulletSwaps(MASTER, [entry({ role: "Designer", employer: "Other Co" })], "TypeScript API performance"), []);
    assert.deepEqual(compatibleBulletListIndexes(MASTER, { role: "Engineer", employer: "Other Co" }), []);
    assert.deepEqual(suggestBulletSwaps(MASTER, [entry({ role: "Engineer", employer: "Other Co" })], "TypeScript API performance"), []);
    assert.deepEqual(compatibleBulletListIndexes(MASTER, { role: "Designer", employer: "Acme" }), []);
    assert.deepEqual(compatibleBulletListIndexes(MASTER, { role: "Intern", employer: "Acme" }), []);
    assert.deepEqual(compatibleBulletListIndexes(MASTER, { role: "Software Engineer", employer: "Acme" }), []);
    assert.deepEqual(compatibleBulletListIndexes(MASTER, { role: "Engineer", employer: "Resume bank" }), []);
  });

  test("continues past an incompatible first role to suggest a later compatible swap", () => {
    const multiRole = String.raw`\documentclass{article}
\begin{document}
\section{Experience}
\textbf{Designer at Alpha}\begin{itemize}\item Made layouts.\end{itemize}
\textbf{Engineer at Acme}\begin{itemize}\item Helped with software.\end{itemize}
\end{document}`;
    const suggestions = suggestBulletSwaps(multiRole, [entry()], "TypeScript APIs processing performance");
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].targetListLabel, "Engineer at Acme");
  });

  test("scores the bullet itself instead of inflating every bullet with entry-wide skills", () => {
    const ranked = rankExperienceBullets([entry({ bullets: ["Built a compiler.", "Organized the holiday party."], skills: ["TypeScript"] })], "Need TypeScript");
    assert.deepEqual(ranked.map((candidate) => candidate.score), [0, 0]);
    assert.deepEqual(ranked.flatMap((candidate) => candidate.matchedTerms), []);
  });

  test("inserts and batch-applies escaped plain-text bullets without touching the master input", () => {
    const inserted = insertBankBullet(MASTER, 0, "Improved APIs by 40% & shipped $2M value.");
    assert.ok(inserted.includes(String.raw`Improved APIs by 40\% \& shipped \$2M value.`));
    assert.equal(MASTER.includes("Improved APIs"), false);
    const suggestions = suggestBulletSwaps(MASTER, [entry()], "TypeScript API performance processing");
    const applied = applyBulletSwapSuggestions(MASTER, suggestions);
    assert.match(applied, /Built TypeScript APIs/);
    const special = insertBankBullet(MASTER, 0, String.raw`Used C:\tools {safely} #1_name~x^2.`);
    assert.ok(special.includes(String.raw`C:\textbackslash{}tools \{safely\} \#1\_name\textasciitilde{}x\textasciicircum{}2.`));
  });
});
