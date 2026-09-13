export interface ResumeExperience {
  title: string;
  company: string;
  location: string | null;
  dateRange: string | null;
  bullets: string[];
}

export interface ResumeEducation {
  school: string;
  degree: string | null;
  location: string | null;
  dateRange: string | null;
  details: string[];
}

export interface ResumeProject {
  name: string;
  dateRange: string | null;
  bullets: string[];
}

export interface ResumeReference {
  contact: {
    name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    links: string[];
  };
  summary: string | null;
  skills: string[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
  projects: ResumeProject[];
  sections: Array<{ heading: string; text: string }>;
  plainText: string;
}

/** The user's generic master resume, stored locally as raw LaTeX source plus a parsed reference for autofill. */
export interface MasterResume {
  id: string;
  latex: string;
  reference?: ResumeReference;
  updatedAt: string;
}

/** A structured, locally stored experience record used only as evidence while tailoring. */
export interface ExperienceEntry {
  id: string;
  role: string;
  employer: string;
  startDate: string | null;
  endDate: string | null;
  bullets: string[];
  skills: string[];
  source?: string;
  /** Name of the bank file this entry was imported from, so several uploads stay distinguishable. */
  bank?: string;
}

/** A persisted tailored resume version derived from (but separate from) the master resume. */
export interface TailoredResumeRecord {
  id: string;
  masterId: string;
  latex: string;
  company: string | null;
  title: string | null;
  jobUrl: string | null;
  jobDescription: string | null;
  changesSummary: string[];
  createdAt: string;
}

/** Effective tailoring options aligned with skills/resume-surgeon/references/candidate_preferences.md. */
export interface TailoringPreferences {
  targetRoles: string[];
  priorityThemes: string[];
  mustPreserveEntryIds: string[];
  mustPreserveSectionIds: string[];
  allowedSectionOrder: string[];
  allowBulletReordering: boolean;
  allowContentRemoval: boolean;
  allowLayoutChanges: boolean;
  allowNewSupportedClaims: boolean;
  tone: string;
  maximumPages: number;
  minimumFontSizePt: number;
  reviewBeforeSave: boolean;
  authorizedEvidenceSourceIds: string[];
  cloudDataScope: string;
}
