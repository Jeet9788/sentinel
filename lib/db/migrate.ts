/**
 * Applies ./drizzle migrations to whichever database is configured.
 * Run against Neon by setting DATABASE_URL; otherwise it migrates local PGlite.
 */
import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";

import { db, isNeon } from "./index";

async function main() {
  const target = isNeon ? "Neon" : `PGlite (${process.env.PGLITE_DIR ?? ".data/pglite"})`;
  console.log(`migrating ${target}...`);

  const options = { migrationsFolder: "./drizzle" };
  if (isNeon) {
    await migrateNeon(db, options);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migratePglite(db as any, options);
  }

  console.log("migrations applied");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
