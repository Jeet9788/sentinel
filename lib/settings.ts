import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { settings, type Settings } from "@/lib/db/schema";

/** The live policy. Server components read it directly rather than round-tripping through HTTP. */
export async function getSettings(): Promise<Settings> {
  const row = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
  if (!row) {
    throw new Error("settings row missing — run `pnpm db:seed`");
  }
  return row;
}
