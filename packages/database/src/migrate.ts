import { migrate } from "drizzle-orm/libsql/migrator";
import type { GhostboardDb } from "./client";

/** Run pending migrations. Call once from Electron main on startup. */
export async function runMigrations(db: GhostboardDb, migrationsFolder: string): Promise<void> {
  await migrate(db, { migrationsFolder });
}
