import type { DetectedFormField, ProfileField } from "@ghostboard/shared";

export interface FieldMatchResult {
  field: DetectedFormField;
  matchedProfileKey: string | null;
  confidence: number;
}

const PROFILE_FIELD_ALIASES: Record<string, string[]> = {
  firstName: [
    "first name",
    "firstname",
    "given name",
    "fname",
    "first_name",
    "your first name",
    "candidate first name",
  ],
  lastName: [
    "last name",
    "lastname",
    "family name",
    "surname",
    "lname",
    "last_name",
    "your last name",
    "candidate last name",
  ],
  fullName: [
    "full name",
    "fullname",
    "name",
    "candidate name",
    "legal name",
    "first name",
    "last name",
    "first_name",
    "last_name",
    "fname",
    "lname",
    "firstname",
    "lastname",
    "given name",
    "family name",
    "your name",
    "display name",
  ],
  email: [
    "email",
    "e mail",
    "email address",
    "work email",
    "personal email",
    "mail",
    "emailaddress",
    "contact email",
  ],
  phone: [
    "phone",
    "phone number",
    "telephone",
    "mobile",
    "cell",
    "cell phone",
    "contact number",
    "mobile number",
    "phone number mobile",
  ],
  linkedin: [
    "linkedin",
    "linkedin profile",
    "linkedin url",
    "linkedin_url",
    "linked in",
    "profile url",
    "social profile",
    "portfolio url",
  ],
  github: [
    "github",
    "github profile",
    "github url",
    "github_url",
    "git hub",
    "portfolio url",
    "website",
  ],
  resumeSummary: [
    "summary",
    "professional summary",
    "profile summary",
    "candidate summary",
    "about you",
    "tell us about yourself",
  ],
  resumeSkills: [
    "skills",
    "technical skills",
    "technologies",
    "programming languages",
    "tools",
    "frameworks",
    "software skills",
  ],
  resumeExperience: [
    "experience",
    "work experience",
    "employment history",
    "professional experience",
    "work history",
    "relevant experience",
    "previous employment",
  ],
  resumeEducation: [
    "education",
    "school",
    "university",
    "college",
    "degree",
    "academic background",
  ],
  resumeProjects: [
    "projects",
    "portfolio projects",
    "relevant projects",
    "personal projects",
  ],
  resumeText: [
    "resume",
    "cv",
    "paste resume",
    "resume text",
    "curriculum vitae",
  ],
};

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalize(value).split(/\s+/).filter(Boolean));
}

function scoreAlias(fieldText: string, alias: string): number {
  const normalizedField = normalize(fieldText);
  const normalizedAlias = normalize(alias);

  if (!normalizedField || !normalizedAlias) return 0;
  if (normalizedField === normalizedAlias) return 1;
  if (normalizedField.includes(normalizedAlias) || normalizedAlias.includes(normalizedField)) return 0.95;

  const fieldTokens = tokenSet(fieldText);
  const aliasTokens = tokenSet(alias);
  const overlap = [...aliasTokens].filter((token) => fieldTokens.has(token)).length;
  const total = Math.max(aliasTokens.size, fieldTokens.size);
  if (total === 0) return 0;

  return (overlap / total) * 0.8;
}

function fieldText(field: DetectedFormField): string {
  const selectorText = field.selector.replace(/[#.:[\]>\s]+/g, " ");
  return [field.label, field.name, field.placeholder, selectorText, ...(field.options ?? [])].filter(Boolean).join(" ");
}

function workdayResumeField(text: string, profileFields: ProfileField[]): { matchedProfileKey: string; confidence: number } | null {
  const normalizedText = normalize(text);
  const findExperienceField = (suffix: string) => profileFields.find((field) => new RegExp(`^resumeExperience\\d+${suffix}$`).test(field.key) && field.value.trim());
  const findEducationField = (suffix: string) => profileFields.find((field) => new RegExp(`^resumeEducation\\d+${suffix}$`).test(field.key) && field.value.trim());

  const description = findExperienceField("Description");
  if (description && /\b(?:role description|description|responsibilities|duties|achievements)\b/.test(normalizedText)) {
    return { matchedProfileKey: description.key, confidence: 0.94 };
  }

  const experienceTitle = findExperienceField("Title");
  if (experienceTitle && /\b(?:job title|position title|title)\b/.test(normalizedText)) {
    return { matchedProfileKey: experienceTitle.key, confidence: 0.94 };
  }

  const company = findExperienceField("Company");
  if (company && /\b(?:company|employer|organization|organisation)\b/.test(normalizedText)) {
    return { matchedProfileKey: company.key, confidence: 0.94 };
  }

  const location = findExperienceField("Location");
  if (location && /\b(?:location|city|country|region|state|province)\b/.test(normalizedText)) {
    return { matchedProfileKey: location.key, confidence: 0.9 };
  }

  const current = findExperienceField("Current");
  if (current && /\b(?:currently work here|current role|present|current job)\b/.test(normalizedText)) {
    return { matchedProfileKey: current.key, confidence: 0.94 };
  }

  const from = findExperienceField("From");
  if (from && /\b(?:from|start date|start month|start year)\b/.test(normalizedText)) {
    return { matchedProfileKey: from.key, confidence: 0.9 };
  }

  const to = findExperienceField("To");
  if (to && /\b(?:to|end date|end month|end year)\b/.test(normalizedText)) {
    return { matchedProfileKey: to.key, confidence: 0.9 };
  }

  const school = findEducationField("School");
  if (school && /\b(?:school|university|college|institution)\b/.test(normalizedText)) {
    return { matchedProfileKey: school.key, confidence: 0.94 };
  }

  const degree = findEducationField("Degree");
  if (degree && /\b(?:degree|program|field of study|major)\b/.test(normalizedText)) {
    return { matchedProfileKey: degree.key, confidence: 0.94 };
  }

  const educationLocation = findEducationField("Location");
  if (educationLocation && /\b(?:school location|education location|campus location)\b/.test(normalizedText)) {
    return { matchedProfileKey: educationLocation.key, confidence: 0.9 };
  }

  const educationDate = findEducationField("Date");
  if (educationDate && /\b(?:graduation date|dates attended|completion date|expected graduation)\b/.test(normalizedText)) {
    return { matchedProfileKey: educationDate.key, confidence: 0.9 };
  }

  return null;
}

export function matchFormField(field: DetectedFormField, profileFields: ProfileField[]): FieldMatchResult {
  const text = fieldText(field);
  if (!text.trim()) {
    return { field, matchedProfileKey: null, confidence: 0 };
  }

  const workdayMatch = workdayResumeField(text, profileFields);
  if (workdayMatch) return { ...workdayMatch, field };

  const directTypeHints = new Map<string, string>([
    ["email", "email"],
    ["phone", "phone"],
    ["linkedin", "linkedin"],
    ["github", "github"],
    ["portfolio", "github"],
    ["website", "github"],
    ["first name", "firstName"],
    ["last name", "lastName"],
    ["full name", "fullName"],
    ["paste resume", "resumeText"],
    ["resume text", "resumeText"],
    ["technical skills", "resumeSkills"],
    ["work experience", "resumeExperience"],
    ["employment history", "resumeExperience"],
  ]);

  for (const [hint, key] of directTypeHints) {
    if (normalize(text).includes(normalize(hint))) {
      const profileField = profileFields.find((candidate) => candidate.key === key && candidate.value.trim());
      if (profileField) {
        return { field, matchedProfileKey: key, confidence: 0.96 };
      }
    }
  }

  let bestMatch: { key: string; score: number } | null = null;

  for (const profileField of profileFields) {
    const aliases = PROFILE_FIELD_ALIASES[profileField.key] ?? [profileField.label, profileField.key];
    let bestAliasScore = 0;

    for (const alias of aliases) {
      const score = scoreAlias(text, alias);
      if (score > bestAliasScore) bestAliasScore = score;
    }

    if (bestAliasScore > 0 && (!bestMatch || bestAliasScore > bestMatch.score)) {
      bestMatch = { key: profileField.key, score: bestAliasScore };
    }
  }

  if (!bestMatch || bestMatch.score < 0.5) {
    return { field, matchedProfileKey: null, confidence: 0 };
  }

  return {
    field,
    matchedProfileKey: bestMatch.key,
    confidence: Math.min(1, bestMatch.score),
  };
}
