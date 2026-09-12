import { getProvider } from "@ghostboard/ai";
import type { ResumeCustomizeRequest, ResumeCustomizeResult } from "./types";
import { diffLatex } from "./latex";

/**
 * Tailors a master LaTeX resume to a job description.
 *
 * Provider plumbing (getProvider()) is real and wired, but the actual
 * prompt-building + LaTeX rewriting is TODO(team)[resume] — for now this
 * returns the original LaTeX unchanged so the app never crashes.
 */
export async function customizeResume(request: ResumeCustomizeRequest): Promise<ResumeCustomizeResult> {
  const provider = getProvider();
  void provider; // TODO(team)[resume]: build a real prompt from request.jobDescription and call provider.complete(...)
  void request;

  return {
    latex: request.masterLatex,
    changesSummary: diffLatex(request.masterLatex, request.masterLatex),
  };
}
