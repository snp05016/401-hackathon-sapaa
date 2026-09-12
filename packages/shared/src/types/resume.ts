/** The user's generic master resume, stored locally as raw LaTeX source. */
export interface MasterResume {
  id: string;
  latex: string;
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
