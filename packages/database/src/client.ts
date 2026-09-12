import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type GhostboardDb = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(filePath: string): GhostboardDb {
  const client = createClient({ url: `file:${filePath}` });
  return drizzle(client, { schema });
}
