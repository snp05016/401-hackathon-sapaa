import type { ExperienceEntry } from "@ghostboard/shared";
import type { ParsedExperienceEntry } from "@ghostboard/resume";

export function mergeImportedExperienceEntries(
  existing: ExperienceEntry[],
  proposed: ExperienceEntry[],
): ExperienceEntry[] {
  const seen = new Set<string>();
  for (const entry of existing) {
    const key = `${entry.role.toLowerCase()}|${entry.employer.toLowerCase()}`;
    seen.add(key);
  }

  const accepted: ExperienceEntry[] = [];
  for (const entry of proposed) {
    if (!entry.role.trim() && !entry.employer.trim()) continue;
    if (entry.role.length > 200 || entry.employer.length > 200) continue;

    const key = `${entry.role.toLowerCase()}|${entry.employer.toLowerCase()}`;
    if (seen.has(key)) continue;

    seen.add(key);
    accepted.push({
      ...entry,
      skills: entry.skills ?? [],
      source: entry.source ?? "experience",
    });
    if (accepted.length >= 200) break;
  }

  return [...existing, ...accepted];
}