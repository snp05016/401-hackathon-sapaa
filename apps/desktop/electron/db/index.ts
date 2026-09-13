import { app } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createDb, runMigrations, type GhostboardDb } from "@ghostboard/database";
import type { ExperienceEntry, MasterResume, Profile, ProfileField, TailoredResumeRecord } from "@ghostboard/shared";
import { orderExperienceEntries } from "../resume/import";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: GhostboardDb | null = null;

export const DEFAULT_PROFILE_FIELDS: ProfileField[] = [
  { key: "firstName", label: "First name", value: "", category: "personal" },
  { key: "lastName", label: "Last name", value: "", category: "personal" },
  { key: "email", label: "Email", value: "", category: "contact" },
  { key: "phone", label: "Phone", value: "", category: "contact" },
  { key: "address", label: "Address", value: "", category: "personal" },
  { key: "country", label: "Country", value: "", category: "personal" },
  { key: "linkedin", label: "LinkedIn URL", value: "", category: "links" },
  { key: "github", label: "GitHub URL", value: "", category: "links" },
  { key: "veteranStatus", label: "Veteran status", value: "", category: "eeo" },
  { key: "lgbtqStatus", label: "LGBTQ+ status", value: "", category: "eeo" },
  { key: "gender", label: "Gender", value: "", category: "eeo" },
];

export function normalizeProfileFields(fields: ProfileField[] | undefined): ProfileField[] {
  const byKey = new Map<string, ProfileField>();

  for (const field of DEFAULT_PROFILE_FIELDS) {
    byKey.set(field.key, { ...field });
  }

  for (const field of fields ?? []) {
    if (field.key === "fullName") continue;
    if (!field.key || !field.label) continue;
    byKey.set(field.key, { ...field, label: field.label.trim() || byKey.get(field.key)?.label || field.key });
  }

  const normalized = [...DEFAULT_PROFILE_FIELDS].map((field) => ({ ...field, value: byKey.get(field.key)?.value ?? "" }));
  for (const field of byKey.values()) {
    if (!normalized.some((candidate) => candidate.key === field.key)) {
      normalized.push({ ...field, value: field.value ?? "" });
    }
  }

  return normalized.filter((field) => field.key !== "fullName");
}

export async function initDb(): Promise<GhostboardDb> {
  if (db) return db;
  const userDataPath = app.getPath("userData");
  fs.mkdirSync(userDataPath, { recursive: true });
  const dbPath = process.env.GHOSTBOARD_DB_PATH ?? path.join(userDataPath, "ghostboard.db");
  const newDb = createDb(dbPath);

  // electron-vite bundles electron/main.ts (and everything it imports, this
  // file included) into a single out/main/main.js — so __dirname here always
  // resolves to that bundle's directory, not process.cwd() (which varies by
  // how `npm run dev` was invoked). Walk up from out/main to the repo root.
  const migrationsFolder = path.join(__dirname, "../../../../packages/database/migrations");
  if (fs.existsSync(migrationsFolder)) {
    await runMigrations(newDb, migrationsFolder);
  } else {
    console.error(`[db] migrations folder not found at ${migrationsFolder} — applications table will be missing`);
  }

  db = newDb;
  return db;
}

function profilePath(): string {
  return path.join(app.getPath("userData"), "profile.json");
}

export function readProfile(): Profile {
  const file = profilePath();
  if (!fs.existsSync(file)) {
    const seeded: Profile = { id: "local", fields: DEFAULT_PROFILE_FIELDS, updatedAt: new Date().toISOString() };
    fs.writeFileSync(file, JSON.stringify(seeded, null, 2));
    return seeded;
  }

  const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as Profile;
  const normalized = normalizeProfileFields(parsed.fields);
  const profile: Profile = { ...parsed, id: "local", fields: normalized, updatedAt: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(profile, null, 2));
  return profile;
}

export function writeProfile(fields: ProfileField[]): Profile {
  const normalized = normalizeProfileFields(fields);
  const profile: Profile = { id: "local", fields: normalized, updatedAt: new Date().toISOString() };
  fs.writeFileSync(profilePath(), JSON.stringify(profile, null, 2));
  return profile;
}

function masterResumePath(): string {
  return path.join(app.getPath("userData"), "master-resume.json");
}

function experienceBankPath(): string {
  return path.join(app.getPath("userData"), "experience-bank.json");
}

function tailoredResumesPath(): string {
  return path.join(app.getPath("userData"), "tailored-resumes.json");
}

function isMasterResume(value: unknown): value is MasterResume {
  return !!value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string";
}

function isExperienceEntry(value: unknown): value is ExperienceEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "string"
    && typeof entry.role === "string"
    && typeof entry.employer === "string"
    && Array.isArray(entry.bullets) && entry.bullets.every((bullet) => typeof bullet === "string")
    && Array.isArray(entry.skills) && entry.skills.every((skill) => typeof skill === "string");
}

function isExperienceBankFile(value: unknown): value is { version: 1; entries: ExperienceEntry[] } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { version?: unknown; entries?: unknown };
  return candidate.version === 1 && Array.isArray(candidate.entries) && candidate.entries.every(isExperienceEntry);
}

function isTailoredResumeRecord(value: unknown): value is TailoredResumeRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.latex === "string";
}

function isTailoredResumeFile(value: unknown): value is { version: 1; records: TailoredResumeRecord[] } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { version?: unknown; records?: unknown };
  return candidate.version === 1 && Array.isArray(candidate.records) && candidate.records.every(isTailoredResumeRecord);
}

/**
 * Seed a fresh JSON file on first read and fall back to a seeded value on
 * corrupt content so main never crashes on a hand-edited or partial file.
 */
function readJsonFile<T>(file: string, isWellFormed: (value: unknown) => value is T, seed: () => T): T {
  if (!fs.existsSync(file)) {
    const value = seed();
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
    return value;
  }
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (isWellFormed(parsed)) return parsed;
  } catch {
    return seed();
  }
  return seed();
}

/** Read-only: nothing currently persists a master resume from the UI, so this seeds an empty placeholder on first read. */
export function readMasterResume(): MasterResume {
  return readJsonFile(masterResumePath(), isMasterResume, () => ({ id: "local", latex: "", updatedAt: new Date().toISOString() }));
}

export function writeMasterResume(latex: string): MasterResume {
  const master: MasterResume = { id: "local", latex, updatedAt: new Date().toISOString() };
  fs.writeFileSync(masterResumePath(), JSON.stringify(master, null, 2));
  return master;
}

export function readExperienceBank(): ExperienceEntry[] {
  const entries = readJsonFile(
    experienceBankPath(),
    isExperienceBankFile,
    (): { version: 1; entries: ExperienceEntry[] } => ({ version: 1, entries: [] }),
  ).entries;
  return orderExperienceEntries(entries);
}

export function writeExperienceBank(entries: ExperienceEntry[]): ExperienceEntry[] {
  const ordered = orderExperienceEntries(entries);
  fs.writeFileSync(experienceBankPath(), JSON.stringify({ version: 1, entries: ordered }, null, 2));
  return ordered;
}

export function readTailoredResumes(): TailoredResumeRecord[] {
  return readJsonFile(
    tailoredResumesPath(),
    isTailoredResumeFile,
    (): { version: 1; records: TailoredResumeRecord[] } => ({ version: 1, records: [] }),
  ).records;
}

export function writeTailoredResumes(records: TailoredResumeRecord[]): TailoredResumeRecord[] {
  fs.writeFileSync(tailoredResumesPath(), JSON.stringify({ version: 1, records }, null, 2));
  return records;
}
