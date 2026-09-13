import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { applyBulletDocument, benchBullets, decodeBulletText, encodeBulletText, parseBulletDocument } from "./bulletDocument";

const MACRO_RESUME = String.raw`\documentclass{article}
\begin{document}
\section{Experience}
\resumeSubHeadingListStart
    \resumeSubheading
      {\large Software Engineer}{Aug 2026 -- Present}
      {BuildSouk}{Dubai, UAE}
      \resumeItemListStart
            \resumeItem{Built \textbf{BuildSouk}, a B2B marketplace, in \textbf{TypeScript}.}
            \resumeItem{Pushed tenant isolation with forced \textbf{row-level security}.}
            \resumeItem{Shipped a 49-screen \textbf{React Native} app.}
      \resumeItemListEnd
\resumeSubHeadingListEnd
\section{Technical Skills}
\begin{itemize}[leftmargin=0.15in, label={}]
    \item{\textbf{Languages:}}{ Python, Go }
\end{itemize}
\end{document}`;

const ITEMIZE_RESUME = String.raw`\documentclass{article}
\begin{document}
\section{Experience}
\textbf{Backend Developer} \hfill 2024
\begin{itemize}
    \item Developed REST APIs using Python and Flask.
    \item Designed and optimized SQL queries.
\end{itemize}
\end{document}`;

describe("bulletDocument", () => {
  test("reads bullets under their role, skipping the skills section", () => {
    const lists = parseBulletDocument(MACRO_RESUME);
    assert.equal(lists.length, 1);
    assert.equal(lists[0].label, "Software Engineer");
    assert.equal(lists[0].style, "resumeItem");
    assert.deepEqual(lists[0].bullets.map((bullet) => bullet.text.slice(0, 13)), ["Built BuildSo", "Pushed tenant", "Shipped a 49-"]);
  });

  test("reads plain itemize bullets too", () => {
    const lists = parseBulletDocument(ITEMIZE_RESUME);
    assert.equal(lists.length, 1);
    assert.equal(lists[0].style, "item");
    assert.equal(lists[0].bullets.length, 2);
  });

  for (const [name, latex] of [["macro", MACRO_RESUME], ["itemize", ITEMIZE_RESUME]] as const) {
    test(`an untouched ${name} document rewrites byte-identically`, () => {
      assert.equal(applyBulletDocument(latex, parseBulletDocument(latex)), latex);
    });
  }

  test("reordering and removing rewrites the source and keeps the bullet's own LaTeX", () => {
    const lists = parseBulletDocument(MACRO_RESUME);
    const [first, , third] = lists[0].bullets;
    const edited = applyBulletDocument(MACRO_RESUME, [{ ...lists[0], bullets: [third, first] }]);
    assert.match(edited, /\\resumeItem\{Shipped a 49-screen \\textbf\{React Native\} app\.\}\n\s+\\resumeItem\{Built/);
    assert.doesNotMatch(edited, /row-level security/);
    assert.equal(parseBulletDocument(edited)[0].bullets.length, 2);
  });

  test("bench holds the bullets the tailored version dropped", () => {
    const lists = parseBulletDocument(MACRO_RESUME);
    const edited = applyBulletDocument(MACRO_RESUME, [{ ...lists[0], bullets: lists[0].bullets.slice(0, 1) }]);
    assert.deepEqual(benchBullets(MACRO_RESUME, edited).map((bullet) => bullet.text.slice(0, 13)), ["Pushed tenant", "Shipped a 49-"]);
    assert.deepEqual(benchBullets(MACRO_RESUME, MACRO_RESUME), []);
  });

  test("plain-text edits escape LaTeX control characters and remain readable", () => {
    const text = String.raw`Improved R&D throughput by 25% with C_# and $5 budgets {yearly} ~ ^ \\`;
    const encoded = encodeBulletText(text);
    assert.equal(decodeBulletText(encoded), text);
    assert.match(encoded, /R\\&D/);
    assert.match(encoded, /25\\%/);
    assert.match(encoded, /C\\_\\#/);
    assert.match(encoded, /\\textbackslash\{\}/);
  });
});
