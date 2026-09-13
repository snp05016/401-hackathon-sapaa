import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { parseExperienceBank, parseMasterLatex, parseSkillList, parseTextBank, type ParsedExperienceEntry } from "./parseMasterLatex";

const SAMPLE_LATEX = String.raw`
\documentclass{article}
\pagestyle{empty}
\begin{document}

\begin{center}
{\Huge\textbf{Your Name}}

Your City, Province | your.email@example.com | (555) 555-0100
\end{center}

\section{Professional Summary}
Write two or three truthful sentences here.

\section{Experience}

\textbf{Your most recent role} -- Jan 2022 to Present\\
\textit{Your Employer, Your City}
\begin{itemize}
  \item One concrete accomplishment, with a number if you have one.
  \item A second accomplishment that shows scope or ownership.
\end{itemize}

\textbf{An earlier role} -- Jun 2019 to Dec 2021\\
\textit{Your Employer, Your City}
\begin{itemize}
  \item One concrete accomplishment.
  \item A second accomplishment.
\end{itemize}

\section{Education}

\textbf{Your degree} -- Graduation year\\
\textit{Your University, Your City}
\end{document}
`;

function assertEntry(entry: ParsedExperienceEntry, expected: Partial<ParsedExperienceEntry> & { role: string; employer: string }) {
  assert.equal(entry.role, expected.role);
  assert.equal(entry.employer, expected.employer);
  assert.equal(entry.startDate, expected.startDate);
  assert.equal(entry.endDate, expected.endDate);
  assert.deepEqual(entry.bullets, expected.bullets);
}

describe("parseMasterLatex", () => {
  test("parses the exact sample format from Resumes.tsx", () => {
    const entries = parseMasterLatex(SAMPLE_LATEX);
    assert.equal(entries.length, 2);

    assertEntry(entries[0], {
      role: "Your most recent role",
      employer: "Your Employer",
      startDate: "2022-01-01",
      endDate: null,
      bullets: [
        "One concrete accomplishment, with a number if you have one.",
        "A second accomplishment that shows scope or ownership.",
      ],
    });

    assertEntry(entries[1], {
      role: "An earlier role",
      employer: "Your Employer",
      startDate: "2019-06-01",
      endDate: "2021-12-01",
      bullets: [
        "One concrete accomplishment.",
        "A second accomplishment.",
      ],
    });
  });

  test("parses subsection format", () => {
    const latex = String.raw`
\documentclass{article}
\begin{document}
\section{Experience}
\subsection{Senior Engineer at Acme Corp}
\begin{itemize}
  \item Built scalable systems.
  \item Led team of 5.
\end{itemize}
\subsection{Junior Dev -- Jan 2020 to Dec 2021 at Startup Inc}
\begin{itemize}
  \item Wrote tests.
\end{itemize}
\end{document}
`;
    const entries = parseMasterLatex(latex);
    assert.equal(entries.length, 2);

    assertEntry(entries[0], {
      role: "Senior Engineer",
      employer: "Acme Corp",
      startDate: null,
      endDate: null,
      bullets: ["Built scalable systems.", "Led team of 5."],
    });

    assertEntry(entries[1], {
      role: "Junior Dev",
      employer: "Startup Inc",
      startDate: "2020-01-01",
      endDate: "2021-12-01",
      bullets: ["Wrote tests."],
    });
  });

  test("parses Jake-style resumeSubheading and resumeItem macros", () => {
    const latex = String.raw`
\documentclass{article}
\newcommand{\resumeSubheading}[4]{#1 #2 #3 #4}
\newcommand{\resumeItem}[1]{\item #1}
\begin{document}
\section{Experience}
\resumeSubheading
  {Visfuture Inc.}{Markham, ON}
  {Software Developer}{July 2024 -- Aug. 2024, May 2025 -- Aug. 2025}
\resumeItemListStart
  \resumeItem{Implemented multilingual website support.}
  \resumeItem{Built full-stack features using Firebase and Google Cloud.}
\resumeItemListEnd
\resumeSubheading
  {Beacon Hill Golf Club}{Aurora, ON}
  {Golf Course Maintenance}{May 2022 -- July 2022}
\resumeItemListStart
  \resumeItem{Followed work orders and specifications.}
\resumeItemListEnd
\end{document}
`;
    const entries = parseMasterLatex(latex);
    assert.equal(entries.length, 2);
    assertEntry(entries[0], {
      role: "Software Developer",
      employer: "Visfuture Inc.",
      startDate: "2024-07-01",
      endDate: "2024-08-01",
      bullets: [
        "Implemented multilingual website support.",
        "Built full-stack features using Firebase and Google Cloud.",
      ],
    });
    assertEntry(entries[1], {
      role: "Golf Course Maintenance",
      employer: "Beacon Hill Golf Club",
      startDate: "2022-05-01",
      endDate: "2022-07-01",
      bullets: ["Followed work orders and specifications."],
    });
  });

  test("parses various date formats", () => {
    const latex = String.raw`
\documentclass{article}
\begin{document}
\section{Experience}
\textbf{Role A} -- 2021 - 2022\\
\textit{Co A}
\begin{itemize}\item Bullet A\end{itemize}
\textbf{Role B} -- Jun 2019 to Dec 2021\\
\textit{Co B}
\begin{itemize}\item Bullet B\end{itemize}
\textbf{Role C} -- 2020 -- Present\\
\textit{Co C}
\begin{itemize}\item Bullet C\end{itemize}
\end{document}
`;
    const entries = parseMasterLatex(latex);
    assert.equal(entries.length, 3);

    assert.equal(entries[0].startDate, "2021-01-01");
    assert.equal(entries[0].endDate, "2022-01-01");

    assert.equal(entries[1].startDate, "2019-06-01");
    assert.equal(entries[1].endDate, "2021-12-01");

    assert.equal(entries[2].startDate, "2020-01-01");
    assert.equal(entries[2].endDate, null);
  });

  test("strips LaTeX comments but preserves escaped percent", () => {
    const latex = String.raw`
\documentclass{article}
\begin{document}
\section{Experience}
\textbf{Role with \% comment} -- Jan 2022 to Present\\
\textit{Employer}
\begin{itemize}
  \item Bullet 1 % this is a comment
  \item Bullet 2 with 100\% certainty
\end{itemize}
\end{document}
`;
    const entries = parseMasterLatex(latex);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].role, "Role with % comment");
    assert.equal(entries[0].bullets[1], "Bullet 2 with 100% certainty");
  });

  test("returns empty array when no experience section", () => {
    const latex = String.raw`
\documentclass{article}
\begin{document}
\section{Education}
\textbf{BS} -- 2020\\
\textit{School}
\end{document}
`;
    const entries = parseMasterLatex(latex);
    assert.deepEqual(entries, []);
  });

  test("handles missing end date (Present)", () => {
    const latex = String.raw`
\documentclass{article}
\begin{document}
\section{Experience}
\textbf{Current Role} -- Jan 2023 to Present\\
\textit{Company}
\begin{itemize}\item Working here\end{itemize}
\end{document}
`;
    const entries = parseMasterLatex(latex);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].startDate, "2023-01-01");
    assert.equal(entries[0].endDate, null);
  });

  test("handles role at company format", () => {
    const latex = String.raw`
\documentclass{article}
\begin{document}
\section{Experience}
\textbf{Software Engineer at Google} -- Jan 2022 to Dec 2023\\
\textit{Mountain View, CA}
\begin{itemize}\item Did stuff\end{itemize}
\end{document}
`;
    const entries = parseMasterLatex(latex);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].role, "Software Engineer");
    assert.equal(entries[0].employer, "Google");
  });

  test("handles em dash and en dash separators", () => {
    const latex = String.raw`
\documentclass{article}
\begin{document}
\section{Experience}
\textbf{Role A — Company A} -- Jan 2022 to Dec 2022\\
\textit{City}
\begin{itemize}\item A\end{itemize}
\textbf{Role B – Company B} -- Jan 2023 to Present\\
\textit{City}
\begin{itemize}\item B\end{itemize}
\end{document}
`;
    const entries = parseMasterLatex(latex);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].role, "Role A");
    assert.equal(entries[0].employer, "Company A");
    assert.equal(entries[1].role, "Role B");
    assert.equal(entries[1].employer, "Company B");
  });

  test("handles pipe separator", () => {
    const latex = String.raw`
\documentclass{article}
\begin{document}
\section{Experience}
\textbf{Role | Company} -- Jan 2022 to Present\\
\textit{City}
\begin{itemize}\item Bullet\end{itemize}
\end{document}
`;
    const entries = parseMasterLatex(latex);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].role, "Role");
    assert.equal(entries[0].employer, "Company");
  });

  test("caps entries at 50", () => {
    let latex = "\\documentclass{article}\\begin{document}\\section{Experience}";
    for (let i = 0; i < 60; i++) {
      latex += `\n\\textbf{Role ${i}} -- Jan 2022 to Present\\\\\n\\textit{Co ${i}}\n\\begin{itemize}\n\\item Bullet\n\\end{itemize}`;
    }
    latex += "\n\\end{document}";
    const entries = parseMasterLatex(latex);
    assert.equal(entries.length, 50);
  });

  test("caps bullets at 100 per entry and 1000 chars each", () => {
    const longBullet = "x".repeat(1500);
    const latex = String.raw`
\documentclass{article}
\begin{document}
\section{Experience}
\textbf{Role} -- Jan 2022 to Present\\
\textit{Co}
\begin{itemize}
` + Array.from({ length: 110 }, (_, i) => `  \\item Bullet ${i} ${longBullet}`).join("\n") + `
\end{itemize}
\end{document}
`;
    const entries = parseMasterLatex(latex);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].bullets.length, 100);
    assert.equal(entries[0].bullets[0].length, 1000);
  });

  test("skips entries with empty role and employer", () => {
    const latex = String.raw`
\documentclass{article}
\begin{document}
\section{Experience}
\begin{itemize}
  \item Orphan bullet
\end{itemize}
\end{document}
`;
    const entries = parseMasterLatex(latex);
    assert.deepEqual(entries, []);
  });

  test("handles comma separator (last top-level comma)", () => {
    const latex = String.raw`
\documentclass{article}
\begin{document}
\section{Experience}
\textbf{Role, Company, Inc.} -- Jan 2022 to Present\\
\textit{City}
\begin{itemize}\item Bullet\end{itemize}
\end{document}
`;
    const entries = parseMasterLatex(latex);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].role, "Role");
    assert.equal(entries[0].employer, "Company, Inc.");
  });

  test("handles day in date like Dec 15, 2021", () => {
    const latex = String.raw`
\documentclass{article}
\begin{document}
\section{Experience}
\textbf{Role} -- Dec 15, 2021 to Jan 10, 2023\\
\textit{Co}
\begin{itemize}\item Bullet\end{itemize}
\end{document}
`;
    const entries = parseMasterLatex(latex);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].startDate, "2021-12-15");
    assert.equal(entries[0].endDate, "2023-01-10");
  });

  test("handles full month names", () => {
    const latex = String.raw`
\documentclass{article}
\begin{document}
\section{Experience}
\textbf{Role} -- January 2022 to December 2023\\
\textit{Co}
\begin{itemize}\item Bullet\end{itemize}
\end{document}
`;
    const entries = parseMasterLatex(latex);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].startDate, "2022-01-01");
    assert.equal(entries[0].endDate, "2023-12-01");
  });
});

describe("parseSkillList", () => {
  test("flattens every category into one list, whatever the layout", () => {
    const nested = String.raw`
\begin{itemize}[leftmargin=0.15in, label={}, itemsep=-3pt]
  \small{
    \item{\textbf{Languages:}}{ Python (AsyncIO), TypeScript, C/C++ }
    \item{\textbf{Cloud \& Infrastructure:}}{ Docker, AWS (Lambda, S3), Git }
  }
\end{itemize}`;
    // Category labels and itemize options are dropped; a parenthesised list stays one skill.
    assert.deepEqual(parseSkillList(nested), ["Python (AsyncIO)", "TypeScript", "C/C++", "Docker", "AWS (Lambda, S3)", "Git"]);
  });

  test("handles labels with the colon outside the braces, and de-duplicates", () => {
    const inline = String.raw`
\textbf{Languages:} C++, Python \\[2pt]
\textbf{Tools}: Git, Docker, python`;
    assert.deepEqual(parseSkillList(inline), ["C++", "Python", "Git", "Docker"]);
  });

  test("returns an empty list for a section with no skills", () => {
    assert.deepEqual(parseSkillList("   \n  "), []);
  });
});

describe("parseTextBank", () => {
  const BANK = [
    "# Experience",
    "",
    "## Software Engineer — BuildSouk",
    "Aug 2026 – Present | Dubai, UAE",
    "",
    "- Built **BuildSouk**, a B2B marketplace, in TypeScript.",
    "- Pushed tenant isolation with forced row-level security.",
    "Skills: TypeScript, Next.js, AWS (Lambda, S3)",
    "",
    "### Research Assistant, Compiler Lab (May 2025 - Sep 2025)",
    "* Researched compiler optimization.",
    "",
    "Projects",
    "--------",
    "",
    "**Nivesh — AI Equity Platform**",
    "May 2026 -- Present",
    "1. Architected a full-stack platform using Docker.",
  ].join("\n");

  test("reads a role per heading with its bullets, dates, and skills", () => {
    const entries = parseTextBank(BANK);
    assert.equal(entries.length, 3);
    assert.deepEqual(entries.map((entry) => [entry.role, entry.employer]), [
      ["Software Engineer", "BuildSouk"],
      ["Research Assistant", "Compiler Lab"],
      ["Nivesh", "AI Equity Platform"],
    ]);
    assert.equal(entries[0].startDate, "2026-08-01");
    assert.equal(entries[0].endDate, null);
    assert.equal(entries[1].endDate, "2025-09-01");
    // Markdown emphasis is stripped and a parenthesised skill list survives intact.
    assert.deepEqual(entries[0].bullets, [
      "Built BuildSouk, a B2B marketplace, in TypeScript.",
      "Pushed tenant isolation with forced row-level security.",
    ]);
    assert.deepEqual(entries[0].skills, ["TypeScript", "Next.js", "AWS (Lambda, S3)"]);
    assert.deepEqual(entries[2].bullets, ["Architected a full-stack platform using Docker."]);
  });

  test("section headings never become entries", () => {
    assert.deepEqual(parseTextBank("# Experience\n\n## Projects\n\nSkills\n"), []);
  });

  test("a bank that is only a skills list still lands in the bank", () => {
    const entries = parseTextBank("Skills: Python, Docker, AWS (Lambda, S3)");
    assert.deepEqual(entries, [{
      role: "Technical Skills", employer: "Skills", startDate: null, endDate: null,
      bullets: [], skills: ["Python", "Docker", "AWS (Lambda, S3)"], source: "skill",
    }]);
  });

  test("parseExperienceBank routes LaTeX to the LaTeX parser and text to this one", () => {
    const latex = String.raw`\documentclass{article}\begin{document}\section{Experience}
\textbf{Engineer} -- Jan 2020 to Feb 2021\\
\textit{Acme}
\begin{itemize}\item Shipped it.\end{itemize}
\end{document}`;
    assert.equal(parseExperienceBank(latex)[0].employer, "Acme");
    assert.equal(parseExperienceBank(BANK)[0].employer, "BuildSouk");
  });
});
