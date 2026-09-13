import { createDb, applications } from "@ghostboard/database";
import { eq } from "drizzle-orm";
async function main() {
  const db = createDb("/tmp/gb-e2e.db");
  const now = new Date().toISOString();
  await db.update(applications)
    .set({ company: "LIVE UPDATE TEST", status: "offer", updatedAt: now, lastActivityAt: now })
    .where(eq(applications.id, "app-1"));
  console.log("mutated app-1 -> offer");
}
void main();
