import type { ExperienceEntry } from "@ghostboard/shared";

function entryKey(entry: { role: string; employer: string }): string {
  return `${entry.role.toLowerCase()}|${entry.employer.toLowerCase()}`;
}

function isSkillEntry(entry: ExperienceEntry): boolean {
  return (entry.source ?? "experience") === "skill";
}

function normalizedEntry(entry: ExperienceEntry): ExperienceEntry {
  return {
    ...entry,
    skills: entry.skills ?? [],
    source: entry.source ?? "experience",
  };
}

export function mergeImportedExperienceEntries(
  existing: ExperienceEntry[],
  proposed: ExperienceEntry[],
): ExperienceEntry[] {
  const result = existing.slice();
  let appendedCount = 0;

  const proposedSkillEntries = proposed.filter(isSkillEntry);
  const proposedNonSkillEntries = proposed.filter((entry) => !isSkillEntry(entry));

  // The master resume is authoritative for the bank's skills. Whenever the resume
  // declares skills, refresh the matching skill entry in place and drop stale skill
  // rows (for example the older per-category "Software"/"Languages" entries) so
  // skills removed from the resume disappear from the bank after a re-save.
  if (proposedSkillEntries.length > 0) {
    const resumeSkillKeys = new Set<string>();
    for (const entry of proposedSkillEntries) {
      if (!entry.role.trim() && !entry.employer.trim()) continue;
      if (entry.role.length > 200 || entry.employer.length > 200) continue;
      const normalized = normalizedEntry(entry);
      const key = entryKey(normalized);
      resumeSkillKeys.add(key);
      const existingIndex = result.findIndex((candidate) => isSkillEntry(candidate) && entryKey(candidate) === key);
      if (existingIndex >= 0) {
        result[existingIndex] = { ...normalized, id: result[existingIndex].id };
      } else {
        result.push(normalized);
        appendedCount += 1;
      }
    }
    for (let index = result.length - 1; index >= 0; index -= 1) {
      const candidate = result[index];
      if (isSkillEntry(candidate) && !resumeSkillKeys.has(entryKey(candidate))) result.splice(index, 1);
    }
  }

  const byKey = new Map<string, ExperienceEntry>();
  for (const entry of result) {
    byKey.set(entryKey(entry), entry);
  }

  for (const entry of proposedNonSkillEntries) {
    if (!entry.role.trim() && !entry.employer.trim()) continue;
    if (entry.role.length > 200 || entry.employer.length > 200) continue;

    const normalized = normalizedEntry(entry);
    const key = entryKey(normalized);
    const matched = byKey.get(key);
    if (matched) {
      // The resume is the source of truth for the entries it still describes.
      // Refresh the stored entry in place so a re-saved master resume keeps the
      // bank up to date without churning the entry's id or position.
      const refreshedIndex = result.findIndex((candidate) => candidate.id === matched.id);
      if (refreshedIndex >= 0) result[refreshedIndex] = { ...normalized, id: matched.id };
      continue;
    }

    byKey.set(key, normalized);
    result.push(normalized);
    appendedCount += 1;
    if (appendedCount >= 200) break;
  }

  return result;
}