import type { DetectedFormField, ProfileField } from "@ghostboard/shared";

export interface FieldMatchResult {
  field: DetectedFormField;
  matchedProfileKey: string | null;
  confidence: number;
}

/** TODO(team)[autofill]: implement label/name heuristic matching + fuzzy scoring. */
export function matchFormField(field: DetectedFormField, profileFields: ProfileField[]): FieldMatchResult {
  void profileFields;
  return { field, matchedProfileKey: null, confidence: 0 };
}
