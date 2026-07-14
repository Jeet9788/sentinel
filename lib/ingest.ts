import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { cases, settings, transactions, type TopFactor } from "@/lib/db/schema";
import { decide, type Decision } from "@/lib/decision";
import { scoreTransaction } from "@/lib/scorer";

export type IngestInput = {
  /** Client-supplied so retries are idempotent. */
  id?: string;
  features: number[];
  amountCents: number;
  cardLast4: string;
  merchant: string;
  city: string;
  /** Known only because this is a replay of a labeled holdout set. */
  isFraudTruth?: boolean | null;
  ts?: Date;
};

export type IngestResult = {
  id: string;
  seq: number;
  score: number | null;
  decision: Decision;
  scoringError: boolean;
};

/**
 * The write path of the whole system: score, decide, persist — atomically.
 *
 * Two guarantees matter here and are pinned by tests:
 *
 * 1. Fail-safe. If the model is unreachable, the transaction is still recorded
 *    and routed to a human. An outage must never become a silent stream of
 *    approvals, and must never auto-block a customer on no evidence.
 * 2. Idempotency. Ingest is keyed on a client-supplied id, so a retry (or a
 *    double-fired simulator tick) cannot duplicate a transaction, re-open a case
 *    an analyst already resolved, or burn a second inference.
 */
export async function ingestTransaction(input: IngestInput): Promise<IngestResult> {
  const id = input.id ?? crypto.randomUUID();

  const existing = await db.query.transactions.findFirst({
    where: eq(transactions.id, id),
  });
  if (existing) {
    return {
      id: existing.id,
      seq: existing.seq,
      score: existing.score,
      decision: existing.decision,
      scoringError: existing.scoringError,
    };
  }

  const config = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
  if (!config) {
    throw new Error("settings row missing — run `pnpm db:seed`");
  }

  let score: number | null = null;
  let topFactors: TopFactor[] | null = null;
  let modelVersion = "unavailable";

  try {
    const result = await scoreTransaction(input.features);
    score = result.probability;
    topFactors = result.topFactors;
    modelVersion = result.modelVersion;
  } catch (error) {
    console.error("scoring failed, routing to human review:", error);
  }

  const decision: Decision =
    score === null ? "review" : decide(score, { tLow: config.tLow, tHigh: config.tHigh });

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(transactions)
      .values({
        id,
        ts: input.ts ?? new Date(),
        cardLast4: input.cardLast4,
        merchant: input.merchant,
        city: input.city,
        amountCents: input.amountCents,
        features: input.features,
        score,
        topFactors,
        decision,
        scoringError: score === null,
        isFraudTruth: input.isFraudTruth ?? null,
        modelVersion,
      })
      .returning();

    // Only the uncertain band becomes a case. Auto-approved and auto-blocked
    // transactions were settled by policy and need no analyst.
    if (decision === "review") {
      await tx.insert(cases).values({ transactionId: row.id });
    }

    return {
      id: row.id,
      seq: row.seq,
      score: row.score,
      decision: row.decision,
      scoringError: row.scoringError,
    };
  });
}
