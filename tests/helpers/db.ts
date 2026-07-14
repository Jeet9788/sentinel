import { migrate } from "drizzle-orm/pglite/migrator";

import { db, isNeon } from "@/lib/db";
import { cases, replayPool, settings, transactions } from "@/lib/db/schema";

/**
 * Every test suite gets a real Postgres (PGlite in memory), migrated with the
 * same SQL that runs in production. Mocking the database would only prove that
 * the mock behaves the way we imagined.
 *
 * These helpers truncate tables, so this asserts we are not pointed at a real
 * database — vitest.config.ts blanks DATABASE_URL, and this is the backstop if
 * someone ever runs the suite with it set.
 */
export async function setupTestDb(thresholds = { tLow: 0.2, tHigh: 0.8 }) {
  if (isNeon) {
    throw new Error("refusing to run destructive tests against a real database (DATABASE_URL is set)");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: "./drizzle" });
  await db
    .insert(settings)
    .values({
      id: 1,
      tLow: thresholds.tLow,
      tHigh: thresholds.tHigh,
      simBatchMin: 2,
      simBatchMax: 4,
      simMinIntervalSeconds: 15,
    })
    .onConflictDoNothing();
}

export async function resetTables() {
  await db.delete(cases);
  await db.delete(transactions);
  await db.delete(replayPool);
}

export function makeFeatures(fill = 0): number[] {
  return Array.from({ length: 29 }, () => fill);
}
