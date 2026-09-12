export interface KeywordResult {
  keyword: string;
  score: number;
  foundInResume: boolean;
  frequency: number;
  category?: import("./job").KeywordCategory;
}

export interface JobSimilarityResult {
  jobId: string;
  similarJobId: string;
  score: number;
  sharedKeywords: string[];
  reasons: string[];
}
