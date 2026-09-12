import { useEffect, useState } from "react";
import { HtmlGenerator, parse } from "latex.js";
import { customizeResume } from "@ghostboard/resume";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ipc } from "../lib/ipc";

const MASTER_LATEX_PLACEHOLDER = String.raw`
  \documentclass{article}
  \pagestyle{empty}
  \begin{document}

  \begin{center}
  {\Huge\textbf{Lorem Ipsum}}

  Springfield, IL | (555) 019-2834 | lorem.ipsum@example.com
  \end{center}

  \section{Professional Summary}
  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

  \section{Experience}

  \textbf{Senior Dolor Sit Engineer} -- Jan 2020 to Present\\
  \textit{Amet Consectetur Inc., Springfield, IL}
  \begin{itemize}
    \item Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
    \item Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
    \item Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
    \item Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
  \end{itemize}

  \textbf{Adipiscing Elit Specialist} -- Jun 2017 to Dec 2019\\
  \textit{Tempor Incididunt LLC, Chicago, IL}
  \begin{itemize}
    \item Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.
    \item Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.
    \item Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.
  \end{itemize}

  \textbf{Junior Labore Et Intern} -- May 2016 to Aug 2016\\
  \textit{Magna Aliqua Corp., Peoria, IL}
  \begin{itemize}
    \item Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam.
    \item Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur.
  \end{itemize}

  \section{Education}

  \textbf{Master of Science in Lorem Ipsum Engineering} (2017)\\
  \textit{University of Dolor Sit Amet, Springfield, IL}\\
  Thesis: \textit{Consectetur Adipiscing Elit: A Study in Eiusmod Tempor}

  \textbf{Bachelor of Science in Veniam Quisnostrud} (2015)\\
  \textit{College of Exercitation Ullamco, Chicago, IL}\\
  Magna Cum Laude

  \section{Technical Skills}
  \begin{itemize}
    \item \textbf{Languages:} Lorem, Ipsum, Dolor, Sit, Amet, Consectetur
    \item \textbf{Tools:} Sed do eiusmod, tempor incididunt, labore et dolore, magna aliqua
    \item \textbf{Platforms:} Ut enim ad minim, quis nostrud exercitation, ullamco laboris
    \item \textbf{Methodologies:} Agile adipiscing, CI/CD elit, Cloud-based dolor sit, Scrum ipsum
  \end{itemize}

  \section{Certifications}
  \begin{itemize}
    \item Certified Dolor Sit Professional (CDSP), 2019
    \item AWS (Amet Web Services) Lorem Architect, 2021
    \item Magna Aliqua Security+, 2022
  \end{itemize}

  \end{document}
`;

export function Resumes() {
  const [masterLatex, setMasterLatex] = useState(MASTER_LATEX_PLACEHOLDER);
  const [savedLatex, setSavedLatex] = useState(MASTER_LATEX_PLACEHOLDER);
  const [status, setStatus] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");

  useEffect(() => {
    ipc()
      .getMasterResume()
      .then((resume) => {
        const latex = resume.latex.trim() ? resume.latex : MASTER_LATEX_PLACEHOLDER;
        setMasterLatex(latex);
        setSavedLatex(latex);
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "Unable to load saved master resume.");
      });
  }, []);

  useEffect(() => {
    try {
      const generator = new HtmlGenerator({ hyphenate: false });
      parse(masterLatex, { generator });
      setPreviewHtml(`<!doctype html>${generator.htmlDocument().documentElement.outerHTML}`);
      setPreviewError(null);
    } catch (error) {
      setPreviewHtml("");
      setPreviewError(error instanceof Error ? error.message : "Unable to render the LaTeX preview.");
    }
  }, [masterLatex]);

  async function handleTailor() {
    setStatus("Tailoring…");
    try {
      const result = await customizeResume({ masterLatex, jobDescription: "" });
      setStatus(`Done (no-op stub) — ${result.changesSummary.length} changes.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleSaveMasterResume() {
    setStatus("Saving resume JSON...");
    try {
      const resume = await ipc().saveMasterResume(masterLatex);
      setSavedLatex(resume.latex);
      setStatus(`Saved master-resume.json with ${resume.reference?.experience.length ?? 0} experience entries.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save resume.");
    }
  }

  return (
    <div className="min-w-0">
      <h1 className="mb-4 text-2xl font-semibold">Resumes</h1>
      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Master resume</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="sr-only" htmlFor="master-latex">
              Master resume LaTeX source
            </label>
            <textarea
              id="master-latex"
              className="min-h-96 w-full resize-y rounded border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={masterLatex}
              onChange={(event) => setMasterLatex(event.target.value)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {previewError && (
              <p className="text-sm text-red-600" role="alert">
                Unable to render preview: {previewError}
              </p>
            )}
            <iframe
              title="Rendered LaTeX resume preview"
              sandbox=""
              srcDoc={previewHtml}
              className="min-h-96 w-full rounded border border-slate-200 bg-white"
            />
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSaveMasterResume} disabled={masterLatex === savedLatex}>
          Save master resume JSON
        </Button>
        <Button onClick={handleTailor}>Tailor to Job</Button>
      </div>
      {status && <p className="mt-2 text-sm text-slate-500">{status}</p>}
    </div>
  );
}
