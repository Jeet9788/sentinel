import { desc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { cases, transactions } from "@/lib/db/schema";
import { toTxnView } from "@/lib/views";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.enum(["open", "resolved"]).default("open"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** The review queue, riskiest first — an analyst's time goes where it pays most. */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { status, limit } = parsed.data;

  try {
    const rows = await db
      .select({ case: cases, transaction: transactions })
      .from(cases)
      .innerJoin(transactions, eq(cases.transactionId, transactions.id))
      .where(eq(cases.status, status))
      .orderBy(desc(transactions.score))
      .limit(limit);

    return NextResponse.json({
      items: rows.map(({ case: row, transaction }) => ({
        id: row.id,
        status: row.status,
        resolution: row.resolution,
        note: row.note,
        createdAt: row.createdAt.toISOString(),
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
        transaction: toTxnView(transaction),
      })),
    });
  } catch (error) {
    console.error("cases failed:", error);
    return NextResponse.json({ error: "cases failed" }, { status: 500 });
  }
}
