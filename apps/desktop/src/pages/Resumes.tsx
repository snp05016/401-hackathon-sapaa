import { useState } from "react";
import { customizeResume } from "@ghostboard/resume";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

const MASTER_LATEX_PLACEHOLDER = "% TODO: load the user's real master resume LaTeX here\n\\documentclass{article}\n\\begin{document}\nMaster resume placeholder.\n\\end{document}\n";

export function Resumes() {
  const [status, setStatus] = useState<string | null>(null);

  async function handleTailor() {
    setStatus("Tailoring…");
    try {
      const result = await customizeResume({ masterLatex: MASTER_LATEX_PLACEHOLDER, jobDescription: "" });
      setStatus(`Done (no-op stub) — ${result.changesSummary.length} changes.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Resumes</h1>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Master resume</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-600">{MASTER_LATEX_PLACEHOLDER}</pre>
        </CardContent>
      </Card>
      <Button onClick={handleTailor}>Tailor to Job</Button>
      {status && <p className="mt-2 text-sm text-slate-500">{status}</p>}
    </div>
  );
}
