import assert from "node:assert/strict";
import { test } from "node:test";
import { experiencesToJson, parseJobExperiences, parseResumeReference } from "./parseExperience";

const latex = String.raw`
\documentclass{article}
\begin{document}
\begin{center}
{\Huge\textbf{Jayden Ngo}}

Edmonton, AB | (780) 555-1234 | jayden@example.com | github.com/jayden
\end{center}

\section{Professional Summary}
Computer science student building local-first job search tools.

\section{Experience}

\textbf{Software Developer Intern} -- May 2025 to Aug 2025\\
\textit{Acme Inc., Edmonton, AB}
\begin{itemize}
  \item Built a TypeScript extension that detected application forms.
  \item Improved SQLite-backed desktop workflows.
\end{itemize}

\section{Projects}
\textbf{Ghostboard} -- 2026\\
\begin{itemize}
  \item Connected an Electron app with a browser extension.
\end{itemize}

\section{Education}
\textbf{Bachelor of Science in Computer Science} -- 2027\\
\textit{University of Alberta, Edmonton, AB}

\section{Technical Skills}
\begin{itemize}
  \item \textbf{Languages:} TypeScript, Python, SQL
  \item \textbf{Tools:} Electron, React, SQLite
\end{itemize}
\end{document}
`;

test("parseJobExperiences extracts common LaTeX experience entries", () => {
  const experiences = parseJobExperiences(latex);
  assert.equal(experiences.length, 1);
  assert.deepEqual(experiences[0], {
    title: "Software Developer Intern",
    company: "Acme Inc.",
    location: "Edmonton, AB",
    dateRange: "May 2025 to Aug 2025",
    bullets: [
      "Built a TypeScript extension that detected application forms.",
      "Improved SQLite-backed desktop workflows.",
    ],
  });
  assert.match(experiencesToJson(experiences), /Software Developer Intern/);
});

test("parseResumeReference builds autofill-ready resume JSON", () => {
  const reference = parseResumeReference(latex);
  assert.equal(reference.contact.name, "Jayden Ngo");
  assert.equal(reference.contact.email, "jayden@example.com");
  assert.equal(reference.contact.phone, "(780) 555-1234");
  assert.ok(reference.skills.includes("TypeScript"));
  assert.ok(reference.skills.includes("Python"));
  assert.equal(reference.education[0]?.school, "University of Alberta");
  assert.equal(reference.projects[0]?.name, "Ghostboard");
  assert.match(reference.plainText, /local-first job search tools/);
  assert.doesNotMatch(reference.plainText, /itemize/);
});

test("parseResumeReference preserves multiple education entries and their date ranges", () => {
  const multipleEducation = String.raw`
\documentclass{article}
\begin{document}
\section{Education}
\textbf{Master of Science in Data Science} -- Sep 2020 to Apr 2022\\
\textit{University of Toronto, Toronto, ON}
\textbf{Bachelor of Science in Computer Science} -- Sep 2016 to Apr 2020\\
\textit{University of Alberta, Edmonton, AB}
\end{document}`;
  const reference = parseResumeReference(multipleEducation);
  assert.equal(reference.education.length, 2);
  assert.deepEqual(reference.education.map((entry) => ({
    degree: entry.degree,
    school: entry.school,
    dateRange: entry.dateRange,
  })), [
    { degree: "Master of Science in Data Science", school: "University of Toronto", dateRange: "Sep 2020 to Apr 2022" },
    { degree: "Bachelor of Science in Computer Science", school: "University of Alberta", dateRange: "Sep 2016 to Apr 2020" },
  ]);
});
