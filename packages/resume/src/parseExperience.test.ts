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

test("parseResumeReference supports macro-driven resumes used by the desktop sample", () => {
  const macroLatex = String.raw`
\documentclass{article}
\newcommand{\resumeSubheading}[4]{#1 #2 #3 #4}
\newcommand{\resumeItem}[1]{\item #1}
\begin{document}
\begin{center}\textbf{Sample Candidate} | sample@example.com\end{center}
\section{Education}
\resumeSubheading{Example University}{20XX -- 20XX}{B.Sc. Computer Science}{Edmonton, AB}
\section{Experience}
\resumeSubheading{Example Technology Company}{20XX -- 20XX}{Software Engineering Intern}{Remote}
\resumeItemListStart
\resumeItem{Automated a recurring workflow with Python.}
\resumeItemListEnd
\section{Projects}
\resumeProjectHeading{\textbf{Workflow Toolkit} \emph{$|$ Python, SQLite}}{20XX}
\resumeItemListStart
\resumeItem{Built a local workflow service.}
\resumeItemListEnd
\end{document}
`;

  const reference = parseResumeReference(macroLatex);
  assert.equal(reference.experience[0]?.title, "Software Engineering Intern");
  assert.equal(reference.experience[0]?.company, "Example Technology Company");
  assert.equal(reference.experience[0]?.location, "Remote");
  assert.deepEqual(reference.experience[0]?.bullets, ["Automated a recurring workflow with Python."]);
  assert.equal(reference.education[0]?.school, "Example University");
  assert.equal(reference.education[0]?.degree, "B.Sc. Computer Science");
  assert.equal(reference.education[0]?.location, "Edmonton, AB");
  assert.equal(reference.projects[0]?.name, "Workflow Toolkit");
  assert.deepEqual(reference.projects[0]?.bullets, ["Built a local workflow service."]);
});
