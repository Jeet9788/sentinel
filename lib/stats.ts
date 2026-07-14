import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { cases, transactions } from "@/lib/db/schema";

export type Stats = {
  kpis: {
    txns24h: number;
    flagged24h: number;
    blocked24h: number;
    /**
     * Money that was actually going to be lost: blocked transactions that the
     * holdout labels confirm were fraud. Blocking a legitimate customer does not
     * count as a save, so false positives are excluded rather than quietly
     * inflating the number.
     */
    fraudPreventedCents: number;
    openCases: number;
  };
  traffic: { hour: string; count: number; frauds: number }[];
  histogram: {
    bucket: number;
    count: number;
    approved: number;
    review: number;
    blocked: number;
  }[];
};

const DAY = sql`now() - interval '24 hours'`;

export async function getStats(): Promise<Stats> {
  const [kpis] = await db
    .select({
      txns24h: sql<number>`count(*)::int`,
      flagged24h: sql<number>`count(*) filter (where ${transactions.decision} = 'review')::int`,
      blocked24h: sql<number>`count(*) filter (where ${transactions.decision} = 'blocked')::int`,
      fraudPreventedCents: sql<number>`coalesce(sum(${transactions.amountCents}) filter (
        where ${transactions.decision} = 'blocked' and ${transactions.isFraudTruth} = true
      ), 0)::int`,
    })
    .from(transactions)
    .where(gte(transactions.createdAt, DAY));

  const [openCases] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cases)
    .where(eq(cases.status, "open"));

  // Grouped by transaction time, not row-insert time, so backfilled history lands
  // in the hour it belongs to rather than all at once when it was loaded.
  const traffic = await db
    .select({
      hour: sql<string>`date_trunc('hour', ${transactions.ts})`,
      count: sql<number>`count(*)::int`,
      frauds: sql<number>`count(*) filter (where ${transactions.isFraudTruth} = true)::int`,
    })
    .from(transactions)
    .where(gte(transactions.ts, DAY))
    .groupBy(sql`date_trunc('hour', ${transactions.ts})`)
    .orderBy(sql`date_trunc('hour', ${transactions.ts})`);

  // 20 buckets of width 0.05. Expect a hard spike at zero and a small one at the
  // top: a working fraud model is supposed to be bimodal, not bell-shaped.
  //
  // The decision split per bucket matters because a threshold can sit *inside* a
  // bucket — with tHigh at 0.99, the whole block band is narrower than one bucket.
  // Counting decisions rather than inferring them from the bucket's edge is the
  // only way the chart can tell the truth about that bucket.
  const histogram = await db
    .select({
      bucket: sql<number>`least(floor(${transactions.score} * 20), 19)::int`,
      count: sql<number>`count(*)::int`,
      approved: sql<number>`count(*) filter (where ${transactions.decision} = 'approved')::int`,
      review: sql<number>`count(*) filter (where ${transactions.decision} = 'review')::int`,
      blocked: sql<number>`count(*) filter (where ${transactions.decision} = 'blocked')::int`,
    })
    .from(transactions)
    .where(and(gte(transactions.ts, DAY), sql`${transactions.score} is not null`))
    .groupBy(sql`least(floor(${transactions.score} * 20), 19)::int`)
    .orderBy(sql`least(floor(${transactions.score} * 20), 19)::int`);

  const byBucket = new Map(histogram.map((row) => [Number(row.bucket), row]));

  return {
    kpis: {
      txns24h: Number(kpis?.txns24h ?? 0),
      flagged24h: Number(kpis?.flagged24h ?? 0),
      blocked24h: Number(kpis?.blocked24h ?? 0),
      fraudPreventedCents: Number(kpis?.fraudPreventedCents ?? 0),
      openCases: Number(openCases?.count ?? 0),
    },
    traffic: traffic.map((row) => ({
      hour: new Date(row.hour).toISOString(),
      count: Number(row.count),
      frauds: Number(row.frauds),
    })),
    histogram: Array.from({ length: 20 }, (_, i) => {
      const row = byBucket.get(i);
      return {
        bucket: Number((i * 0.05).toFixed(2)),
        count: Number(row?.count ?? 0),
        approved: Number(row?.approved ?? 0),
        review: Number(row?.review ?? 0),
        blocked: Number(row?.blocked ?? 0),
      };
    }),
  };
}
