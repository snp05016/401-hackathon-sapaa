import type { KeywordResult } from "@ghostboard/shared";

/** TODO(team)[matching]: implement real extraction (TF-IDF, RAKE, or LLM-based). */
export function extractKeywords(jobDescription: string): KeywordResult[] {
  void jobDescription;
  return [];
}

/** TODO(team)[matching]: implement scoring + gap analysis. */
export function compareResumeToJob(
  resumeText: string,
  jobDescription: string,
): { matched: KeywordResult[]; missing: KeywordResult[]; overallScore: number } {
  void resumeText;
  void jobDescription;
  return { matched: [], missing: [], overallScore: 0 };
}
