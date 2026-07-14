import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { replayPool, transactions } from "@/lib/db/schema";
import { ingestTransaction } from "@/lib/ingest";

const TOTAL = 900;
const HOURS = 24;
const SKIP_ABOVE = 200;

/** Card traffic has a daily rhythm: busy afternoons, quiet small hours. */
function hourlyWeight(hoursAgo: number): number {
  const hourOfDay = (new Date().getHours() - hoursAgo + 24) % 24;
  return 0.35 + 0.65 * Math.sin(((hourOfDay - 3) / 24) * Math.PI * 2) ** 2;
}

/**
 * Fills a day of history so the console has something to say on first open.
 *
 * Every transaction goes through the real ingest path: scored by the real model,
 * decided by the real policy, explained by the real explainer. The only invented
 * thing is *when* it happened — timestamps are spread across the last 24 hours on
 * a day/night curve rather than all landing at once. No score here is fabricated.
 *
 * This runs inside the app rather than as a standalone script because in local
 * development the database is PGlite, which lives *in* the server process. A
 * separate process opening the same data directory gets its own copy and writes
 * into the void.
 */
export async function backfillHistory(): Promise<{
  ingested: number;
  skipped: boolean;
  counts: Record<string, number>;
}> {
  const [{ existing }] = await db
    .select({ existing: sql<number>`count(*)::int` })
    .from(transactions);

  if (existing > SKIP_ABOVE) {
    return { ingested: 0, skipped: true, counts: {} };
  }

  const pool = await db.select().from(replayPool);
  if (pool.length === 0) {
    throw new Error("replay pool is empty — run `pnpm db:seed` first");
  }

  const weights = Array.from({ length: HOURS }, (_, i) => hourlyWeight(i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const counts: Record<string, number> = { approved: 0, review: 0, blocked: 0 };
  let ingested = 0;

  for (let hoursAgo = HOURS - 1; hoursAgo >= 0; hoursAgo--) {
    const forThisHour = Math.round((weights[hoursAgo] / totalWeight) * TOTAL);

    for (let i = 0; i < forThisHour; i++) {
      const row = pool[Math.floor(Math.random() * pool.length)];
      const ts = new Date(Date.now() - hoursAgo * 3_600_000 + Math.random() * 3_600_000);

      const result = await ingestTransaction({
        features: row.features,
        amountCents: row.amountCents,
        cardLast4: row.cardLast4,
        merchant: row.merchant,
        city: row.city,
        isFraudTruth: row.isFraud,
        ts,
      });

      counts[result.decision] += 1;
      ingested += 1;
    }
  }

  return { ingested, skipped: false, counts };
}
