import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { ingestTransaction } from "@/lib/ingest";
import { drawBatch } from "@/lib/replay";

/** Hard ceiling on a single burst, so the demo button cannot be turned into a load generator. */
export const MAX_BURST = 10;
const BURST_FRAUDS = 3;
/** Roughly one in seven organic batches carries a fraud — frequent enough to watch, rare enough to mean something. */
const TICK_FRAUD_CHANCE = 0.15;

/**
 * Advances the simulated payment stream, but only if the throttle interval has
 * elapsed. The claim is a single conditional UPDATE ... RETURNING, so when five
 * dashboards are open and all five poll at once, exactly one wins the row and
 * the other four are told to do nothing. Without this, traffic would scale with
 * the number of people watching.
 */
export async function tick(): Promise<{ skipped: boolean; ingested: number }> {
  const claimed = await db
    .update(settings)
    .set({ lastTickAt: new Date() })
    .where(
      sql`${settings.id} = 1 and (
        ${settings.lastTickAt} is null
        or ${settings.lastTickAt} < now() - make_interval(secs => ${settings.simMinIntervalSeconds})
      )`,
    )
    .returning();

  if (claimed.length === 0) {
    return { skipped: true, ingested: 0 };
  }

  const { simBatchMin, simBatchMax } = claimed[0];
  const size = simBatchMin + Math.floor(Math.random() * (simBatchMax - simBatchMin + 1));
  const forceFrauds = Math.random() < TICK_FRAUD_CHANCE ? 1 : 0;

  const batch = await drawBatch({ n: size, forceFrauds });
  for (const input of batch) {
    await ingestTransaction(input);
  }

  return { skipped: false, ingested: batch.length };
}

/** The demo button: a burst of traffic guaranteed to contain fraud. */
export async function burst(): Promise<{ ingested: number }> {
  const batch = await drawBatch({ n: MAX_BURST, forceFrauds: BURST_FRAUDS });
  for (const input of batch) {
    await ingestTransaction(input);
  }
  return { ingested: batch.length };
}
