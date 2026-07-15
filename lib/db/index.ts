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

function getDb() {
  return (globalForDb.sentinelDb ??= createDb());
}

/**
 * The database handle, created lazily on first use.
 *
 * Lazy matters at build time: `next build` imports every route module to collect
 * metadata, and an eager connection would boot PGlite inside a build worker that
 * has no database — which aborts. Deferring creation until a query actually runs
 * means importing this module is free.
 *
 * The two drivers expose the same Drizzle surface, so consumers are written
 * against one type; the proxy forwards every access to the real instance.
 */
export const db = new Proxy({} as NeonDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export type Db = NeonDatabase<typeof schema>;
export { schema };
