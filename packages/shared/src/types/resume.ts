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
