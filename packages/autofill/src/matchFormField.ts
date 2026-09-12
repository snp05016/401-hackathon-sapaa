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

export function matchFormField(field: DetectedFormField, profileFields: ProfileField[]): FieldMatchResult {
  const text = fieldText(field);
  if (!text.trim()) {
    return { field, matchedProfileKey: null, confidence: 0 };
  }

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
