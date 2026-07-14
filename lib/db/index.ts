import { mkdirSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";

import * as schema from "./schema";

/**
 * One database module, two drivers, chosen by whether DATABASE_URL exists.
 *
 * Production runs on Neon over its serverless Pool (not the HTTP driver — we need
 * real transactions, because a transaction and its review case must be written
 * atomically or not at all).
 *
 * Local development runs on PGlite, Postgres compiled to WASM and stored in a
 * folder. Same SQL, same migrations, same Drizzle queries, but `git clone &&
 * pnpm dev` needs no database server and no credentials. Tests point PGLITE_DIR
 * at `memory://` and get a fresh database per run.
 */
const connectionString = process.env.DATABASE_URL;

export const isNeon = Boolean(connectionString);

function createDb() {
  if (connectionString) {
    return drizzleNeon(new Pool({ connectionString }), { schema });
  }

  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  if (!dir.startsWith("memory://")) {
    mkdirSync(dir, { recursive: true }); // PGlite will not create nested paths itself
  }
  return drizzlePglite(new PGlite(dir), { schema });
}

// Next.js re-imports server modules on every hot reload; without this a dev
// session would leak a new PGlite instance (and file lock) per edit.
const globalForDb = globalThis as unknown as { sentinelDb?: ReturnType<typeof createDb> };

/**
 * The two drivers expose the same Drizzle surface, so consumers are written
 * against one type. The cast picks the Neon type as the canonical one; it does
 * not change what runs.
 */
export const db = (globalForDb.sentinelDb ??= createDb()) as NeonDatabase<typeof schema>;

export type Db = typeof db;
export { schema };
