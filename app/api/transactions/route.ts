import { and, desc, eq, ilike, lt, or } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { toTxnView } from "@/lib/views";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  decision: z.enum(["approved", "review", "blocked"]).optional(),
  q: z.string().trim().max(64).optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

/** The full ledger: every transaction, filterable, keyset-paginated on `seq`. */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { decision, q, cursor, limit } = parsed.data;

  try {
    const where = and(
      decision ? eq(transactions.decision, decision) : undefined,
      q
        ? or(
            ilike(transactions.merchant, `%${q}%`),
            ilike(transactions.cardLast4, `%${q}%`),
          )
        : undefined,
      cursor ? lt(transactions.seq, cursor) : undefined,
    );

    // Fetch one extra row: its existence is how we know there is a next page,
    // without paying for a second count query.
    const rows = await db
      .select()
      .from(transactions)
      .where(where)
      .orderBy(desc(transactions.seq))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(toTxnView);

    return NextResponse.json({
      items,
      nextCursor: hasMore ? items[items.length - 1].seq : null,
    });
  } catch (error) {
    console.error("transactions failed:", error);
    return NextResponse.json({ error: "transactions failed" }, { status: 500 });
  }
}
