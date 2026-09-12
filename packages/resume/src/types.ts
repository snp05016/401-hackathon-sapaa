import type { ExperienceEntry, Profile, TailoringPreferences } from "@ghostboard/shared";

export interface ResumeCustomizeRequest {
  masterLatex: string;
  jobDescription: string;
  jobContext?: { company?: string; title?: string; jobUrl?: string };
  candidateProfile?: Profile;
  experienceBank?: ExperienceEntry[];
  preferences?: Partial<TailoringPreferences>;
}

export interface ResumeCustomizeResult {
  latex: string;
  changesSummary: string[];
}
