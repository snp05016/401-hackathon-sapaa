export interface JobPosting {
  id: string;
  company: string;
  title: string;
  location: string | null;
  jobUrl: string;
  jobDescription: string;
  source: string;
  postedAt: string | null;
  salaryRange: string | null;
  scrapedAt: string;
}
