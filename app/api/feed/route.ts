import { desc, gt } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { toTxnView } from "@/lib/views";

export const dynamic = "force-dynamic";

const PAGE = 25;

/**
 * The live feed. Cursors on `seq`, not on time: two transactions can share a
 * timestamp, and a client that polls on time would either miss rows or replay
 * them. `seq` is monotonic, so "everything after N" is exact.
 */
export async function GET(request: NextRequest) {
  try {
    const after = Number(request.nextUrl.searchParams.get("after") ?? Number.NaN);

    const rows = await db
      .select()
      .from(transactions)
      .where(Number.isFinite(after) ? gt(transactions.seq, after) : undefined)
      .orderBy(desc(transactions.seq))
      .limit(PAGE);

    const items = rows.map(toTxnView);
    return NextResponse.json({
      items,
      cursor: items.length > 0 ? items[0].seq : Number.isFinite(after) ? after : 0,
    });
  } catch (error) {
    console.error("feed failed:", error);
    return NextResponse.json({ error: "feed failed" }, { status: 500 });
  }
}
