import type { Application } from "@ghostboard/shared";

export interface DuplicateGroup {
  key: string;
  applications: Application[];
}

export function duplicateKey(jobUrl: string): string {
  const trimmed = jobUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed.toLowerCase();
  }
  const host = parsed.host.toLowerCase();
  const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
  // LinkedIn pins the job id in the path; its query string is tracking noise,
  // so two saves of the same posting with different referral params must unify.
  if (path.startsWith("/jobs/view/")) return `${host}${path}`;
  return `${host}${path}?${parsed.searchParams.toString()}`;
}

function collapseWhitespace(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function postingNameKey(application: Application): string {
  return [
    collapseWhitespace(application.company),
    collapseWhitespace(application.title),
    collapseWhitespace(application.location ?? ""),
  ].join("|");
}

/**
 * Content fingerprint for the same posting shared across websites. Distinct
 * postings keep distinct identity keys so unrelated roles never collapse.
 */
export function postingIdentityKey(application: Application): string {
  const description = collapseWhitespace(application.jobDescription);
  if (description) return `description:${description}`;
  return `metadata:${postingNameKey(application)}`;
}

export function findDuplicateApplications(applications: Application[]): DuplicateGroup[] {
  const byUrl = new Map<string, Application[]>();
  for (const application of applications) {
    const key = duplicateKey(application.jobUrl);
    const entries = byUrl.get(key);
    if (entries) entries.push(application);
    else byUrl.set(key, [application]);
  }

  const nameOccurrences = new Map<string, number>();
  for (const application of applications) {
    const nameKey = postingNameKey(application);
    nameOccurrences.set(nameKey, (nameOccurrences.get(nameKey) ?? 0) + 1);
  }

  const byIdentity = new Map<string, Application[]>();
  for (const entries of byUrl.values()) {
    const withDescription = entries.find((entry) => entry.jobDescription.trim());
    const signature = withDescription ? postingIdentityKey(withDescription) : postingNameKey(entries[0]);
    const members = byIdentity.get(signature);
    if (members) members.push(...entries);
    else byIdentity.set(signature, [...entries]);
  }

  const resolved = new Map<string, Application[]>();
  for (const [signature, entries] of byIdentity) {
    const nameKey = postingNameKey(entries[0]);
    // A name match implies the same cross-site posting only when exactly two
    // copies share it; more occurrences mean the name is ambiguous.
    if ((nameOccurrences.get(nameKey) ?? 0) === 2) {
      const merged = resolved.get(nameKey);
      if (merged) merged.push(...entries);
      else resolved.set(nameKey, [...entries]);
    } else {
      resolved.set(signature, entries);
    }
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, entries] of resolved) {
    if (entries.length > 1) groups.push({ key, applications: entries });
  }
  return groups;
}

export function isUniformSource(group: DuplicateGroup): boolean {
  const sources = new Set(group.applications.map((entry) => entry.source));
  return sources.size === 1;
}

export function mixedSourceGroups(applications: Application[]): DuplicateGroup[] {
  return findDuplicateApplications(applications).filter((group) => !isUniformSource(group));
}

export function redundantApplicationIds(applications: Application[]): string[] {
  const ids: string[] = [];
  for (const group of findDuplicateApplications(applications)) {
    if (!isUniformSource(group)) continue;
    const byCreation = [...group.applications].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    for (const extra of byCreation.slice(1)) ids.push(extra.id);
  }
  return ids;
}