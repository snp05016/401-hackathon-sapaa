import { eq } from "drizzle-orm";
import { applications, type GhostboardDb } from "@ghostboard/database";
import { isValidDeadline } from "@ghostboard/tracking";
import type { Application } from "@ghostboard/shared";

export async function updateApplicationDeadline(
  db: GhostboardDb,
  applicationId: unknown,
  deadline: unknown,
): Promise<Application> {
  if (typeof applicationId !== "string" || !applicationId.trim()) {
    throw new Error("Choose a saved job before setting a deadline.");
  }
  if (deadline !== null && !isValidDeadline(deadline)) {
    throw new Error("Enter a valid deadline in YYYY-MM-DD format.");
  }
  const [updated] = await db.update(applications)
    .set({ deadline, updatedAt: new Date().toISOString() })
    .where(eq(applications.id, applicationId))
    .returning();
  if (!updated) throw new Error("This job could not be found. Reload the page and try again.");
  return updated;
}
