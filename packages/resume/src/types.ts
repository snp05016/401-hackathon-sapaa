export interface ResumeCustomizeRequest {
  masterLatex: string;
  jobDescription: string;
}

export interface ResumeCustomizeResult {
  latex: string;
  changesSummary: string[];
}
