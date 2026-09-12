export interface KeywordResult {
  keyword: string;
  score: number;
  foundInResume: boolean;
  frequency: number;
}

export interface JobSimilarityResult {
  jobId: string;
  similarJobId: string;
  score: number;
  sharedKeywords: string[];
}
