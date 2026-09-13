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
  middleName: [
    "middle name",
    "middlename",
    "middle initial",
    "middle_name",
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
  phoneExtension: [
    "phone extension",
    "telephone extension",
    "extension",
    "ext",
    "phone ext",
  ],
  street: [
    "street address",
    "address line 1",
    "address 1",
    "home address",
    "mailing address",
  ],
  city: ["city", "town", "municipality"],
  province: ["province", "state", "region", "province or state", "state province"],
  country: ["country", "country region", "country or region"],
  veteranStatus: ["veteran status", "protected veteran", "veteran"],
  gender: ["gender", "sex"],
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

function monthNumber(month: string): string | null {
  const normalizedMonth = month.toLowerCase().slice(0, 3);
  const index = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(normalizedMonth);
  return index >= 0 ? String(index + 1).padStart(2, "0") : null;
}

export function formatMonthYear(value: string): string | null {
  const text = value.trim();
  const iso = text.match(/\b((?:19|20)\d{2})-(0?[1-9]|1[0-2])\b/);
  if (iso) return `${iso[2].padStart(2, "0")}/${iso[1]}`;
  const numeric = text.match(/\b(0?[1-9]|1[0-2])\s*[/-]\s*((?:19|20)\d{2})\b/);
  if (numeric) return `${numeric[1].padStart(2, "0")}/${numeric[2]}`;

  const named = text.match(/\b([A-Za-z]{3,9})\.?\s+((?:19|20)\d{2})\b/);
  if (!named) return null;
  const month = monthNumber(named[1]);
  return month ? `${month}/${named[2]}` : null;
}

export function splitResumeDateRange(
  dateRange: string | null,
): { from: string | null; to: string | null; current: boolean } {
  if (!dateRange) return { from: null, to: null, current: false };
  const parts = dateRange.split(/\s+(?:to|through|--|[-–—])\s+/i).map((part) => part.trim()).filter(Boolean);
  const from = formatMonthYear(parts[0] ?? dateRange);
  const toText = parts[1] ?? "";
  const current = /\b(?:present|current|now)\b/i.test(toText || dateRange);
  return { from, to: current ? null : formatMonthYear(toText), current };
}

export function valueForDetectedField(field: DetectedFormField, value: string): string {
  const monthYear = formatMonthYear(value);
  if (!monthYear) return value;
  const [month, year] = monthYear.split("/");
  const placeholder = field.placeholder?.toLowerCase() ?? "";
  if (placeholder.includes("mm") && placeholder.includes("yyyy")) return monthYear;

  const evidence = [field.label, field.name, field.placeholder, field.selector]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const isMonthSegment = evidence.includes("month") || /^m{1,2}$/.test(placeholder.trim());
  const isYearSegment = evidence.includes("year") || /^y{2,4}$/.test(placeholder.trim());
  if (isMonthSegment && !isYearSegment) return month;
  if (isYearSegment && !isMonthSegment) return year;
  return monthYear;
}

export function splitEducationDegree(degree: string | null): { level: string | null; fieldOfStudy: string | null } {
  if (!degree?.trim()) return { level: null, fieldOfStudy: null };
  const text = degree.trim();
  const lower = text.toLowerCase();
  const level = /\b(?:ph\.?d\.?|doctor(?:ate|al)?|juris doctor)\b/.test(lower)
    ? "Doctorate"
    : /\b(?:master|m\.?sc\.?|m\.?s\.?|m\.?eng\.?|m\.?a\.?)\b/.test(lower)
      ? "Master's Degree"
      : /\b(?:bachelor|b\.?sc\.?|b\.?s\.?|b\.?eng\.?|b\.?a\.?)\b/.test(lower)
        ? "Bachelor's Degree"
        : /\bassociate(?:'s)?\b/.test(lower)
          ? "Associate's Degree"
          : /\bhigh school\b/.test(lower)
            ? "High School Diploma"
            : null;

  const explicitField = text.match(/\b(?:in|major(?:ed)? in)\s+(.+)$/i)?.[1]?.trim() ?? null;
  let fieldOfStudy = explicitField;
  if (!fieldOfStudy) {
    const scienceOrArts = text.match(/\b(?:bachelor|master)\s+of\s+(?:science|arts|engineering)\s+(?:in\s+)?(.+)$/i)?.[1]?.trim();
    if (scienceOrArts && !/^(?:science|arts|engineering)$/i.test(scienceOrArts)) fieldOfStudy = scienceOrArts;
  }
  if (!fieldOfStudy) {
    fieldOfStudy = text.match(/(?:,|:|\s[-–—]\s)\s*([^,:–—]+)$/)?.[1]?.trim() ?? null;
  }
  fieldOfStudy = fieldOfStudy?.replace(/^[\s,:–—-]+/, "").trim() || null;
  return { level, fieldOfStudy };
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

function fieldIdentityText(field: DetectedFormField): string {
  const selectorText = field.selector.replace(/[#.:[\]>\s]+/g, " ");
  return [field.label, field.name, field.placeholder, selectorText].filter(Boolean).join(" ");
}

function workdayResumeField(text: string, profileFields: ProfileField[]): { matchedProfileKey: string; confidence: number } | null {
  const normalizedText = normalize(text);
  const experiencePosition = normalizedText.match(/\bwork\s*experience\s*(\d+)\b/)?.[1] ?? null;
  const educationPosition = normalizedText.match(/\beducation(?: history)?\s*(\d+)\b/)?.[1] ?? null;
  const findExperienceField = (suffix: string) => profileFields.find((field) => {
    if (educationPosition) return false;
    const keyPattern = experiencePosition
      ? new RegExp(`^resumeExperience${experiencePosition}${suffix}$`)
      : new RegExp(`^resumeExperience\\d+${suffix}$`);
    return keyPattern.test(field.key) && field.value.trim();
  });
  const findEducationField = (suffix: string) => profileFields.find((field) => {
    if (experiencePosition) return false;
    const keyPattern = educationPosition
      ? new RegExp(`^resumeEducation${educationPosition}${suffix}$`)
      : new RegExp(`^resumeEducation\\d+${suffix}$`);
    return keyPattern.test(field.key) && field.value.trim();
  });

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

  const fieldOfStudy = findEducationField("FieldOfStudy");
  if (fieldOfStudy && /\b(?:field of study|major|academic discipline|area of study)\b/.test(normalizedText)) {
    return { matchedProfileKey: fieldOfStudy.key, confidence: 0.96 };
  }

  const degree = findEducationField("Degree");
  if (degree && /\b(?:degree|degree type|degree level|qualification)\b/.test(normalizedText)) {
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

  const educationFrom = findEducationField("From");
  if (educationFrom && /\b(?:from|start date|start month|start year)\b/.test(normalizedText)) {
    return { matchedProfileKey: educationFrom.key, confidence: 0.92 };
  }

  const educationTo = findEducationField("To");
  if (educationTo && /\b(?:to|end date|end month|end year)\b/.test(normalizedText)) {
    return { matchedProfileKey: educationTo.key, confidence: 0.92 };
  }

  return null;
}

export function matchFormField(field: DetectedFormField, profileFields: ProfileField[]): FieldMatchResult {
  const text = fieldText(field);
  const identityText = fieldIdentityText(field);
  if (!text.trim()) {
    return { field, matchedProfileKey: null, confidence: 0 };
  }

  const hasRepeatedResumePosition = /\b(?:work\s*experience|education(?: history)?)\s*\d+\b/.test(normalize(identityText));
  if (hasRepeatedResumePosition) {
    const repeatedMatch = workdayResumeField(text, profileFields);
    return repeatedMatch
      ? { ...repeatedMatch, field }
      : { field, matchedProfileKey: null, confidence: 0 };
  }

  const directTypeHints = new Map<string, string>([
    ["email", "email"],
    ["phone extension", "phoneExtension"],
    ["telephone extension", "phoneExtension"],
    ["phone", "phone"],
    ["linkedin", "linkedin"],
    ["github", "github"],
    ["portfolio", "github"],
    ["website", "github"],
    ["first name", "firstName"],
    ["middle name", "middleName"],
    ["last name", "lastName"],
    ["street address", "street"],
    ["address line 1", "street"],
    ["province", "province"],
    ["state", "province"],
    ["city", "city"],
    ["country", "country"],
    ["full name", "fullName"],
    ["paste resume", "resumeText"],
    ["resume text", "resumeText"],
    ["technical skills", "resumeSkills"],
    ["work experience", "resumeExperience"],
    ["employment history", "resumeExperience"],
  ]);

  for (const [hint, key] of directTypeHints) {
    if (normalize(identityText).includes(normalize(hint))) {
      const profileField = profileFields.find((candidate) => candidate.key === key && candidate.value.trim());
      if (profileField) {
        return { field, matchedProfileKey: key, confidence: 0.96 };
      }
    }
  }

  const workdayMatch = workdayResumeField(text, profileFields);
  if (workdayMatch) return { ...workdayMatch, field };

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
