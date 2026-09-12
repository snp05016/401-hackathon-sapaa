import { app } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createDb, runMigrations, type GhostboardDb } from "@ghostboard/database";
import type { Profile, ProfileField } from "@ghostboard/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: GhostboardDb | null = null;

const DEFAULT_PROFILE_FIELDS: ProfileField[] = [
  { key: "fullName", label: "Full name", value: "", category: "personal" },
  { key: "email", label: "Email", value: "", category: "contact" },
  { key: "phone", label: "Phone", value: "", category: "contact" },
  { key: "linkedin", label: "LinkedIn URL", value: "", category: "links" },
  { key: "github", label: "GitHub URL", value: "", category: "links" },
];

export async function initDb(): Promise<GhostboardDb> {
  if (db) return db;
  const userDataPath = app.getPath("userData");
  fs.mkdirSync(userDataPath, { recursive: true });
  const dbPath = path.join(userDataPath, "ghostboard.db");
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
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Profile;
}

export function writeProfile(fields: ProfileField[]): Profile {
  const profile: Profile = { id: "local", fields, updatedAt: new Date().toISOString() };
  fs.writeFileSync(profilePath(), JSON.stringify(profile, null, 2));
  return profile;
}
