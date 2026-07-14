import { lt, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const RETENTION_DAYS = 7;

/**
 * Daily retention trim, so a demo that runs for months does not slowly fill a
 * free-tier database. Cases cascade with their transaction.
 *
 * Requires CRON_SECRET: this endpoint deletes data, and a URL that deletes data
 * must not be executable by anyone who guesses the path. When the secret is
 * unset (local development) it runs unauthenticated, and says so.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  try {
    const deleted = await db
      .delete(transactions)
      .where(lt(transactions.createdAt, sql`now() - make_interval(days => ${RETENTION_DAYS})`))
      .returning({ id: transactions.id });

    return NextResponse.json({ deleted: deleted.length, retentionDays: RETENTION_DAYS });
  } catch (error) {
    console.error("cleanup failed:", error);
    return NextResponse.json({ error: "cleanup failed" }, { status: 500 });
  }
}
