import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { replayPool } from "@/lib/db/schema";
import type { IngestInput } from "@/lib/ingest";

/**
 * Draws transactions for the simulator from the held-out pool.
 *
 * `forceFrauds` exists for the demo button: fraud is 0.17% of real traffic, so a
 * visitor could watch an honest random stream for a long time and never see the
 * system do the thing it was built to do.
 */
export async function drawBatch({
  n,
  forceFrauds = 0,
}: {
  n: number;
  forceFrauds?: number;
}): Promise<IngestInput[]> {
  const rows: (typeof replayPool.$inferSelect)[] = [];

  if (forceFrauds > 0) {
    rows.push(
      ...(await db
        .select()
        .from(replayPool)
        .where(eq(replayPool.isFraud, true))
        .orderBy(sql`random()`)
        .limit(forceFrauds)),
    );
  }

  const remaining = Math.max(0, n - rows.length);
  if (remaining > 0) {
    rows.push(
      ...(await db.select().from(replayPool).orderBy(sql`random()`).limit(remaining)),
    );
  }

  if (rows.length > 0) {
    const ids = rows.map((row) => row.id);
    await db
      .update(replayPool)
      .set({ usedCount: sql`${replayPool.usedCount} + 1` })
      .where(inArray(replayPool.id, ids));
  }

  return rows.map((row) => ({
    id: crypto.randomUUID(),
    features: row.features,
    amountCents: row.amountCents,
    cardLast4: row.cardLast4,
    merchant: row.merchant,
    city: row.city,
    isFraudTruth: row.isFraud,
    ts: new Date(),
  }));
}
