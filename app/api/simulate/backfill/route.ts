import { NextResponse, type NextRequest } from "next/server";

import { backfillHistory } from "@/lib/backfill";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * One-shot: give a fresh deployment a day of history to display.
 *
 * No-ops once the database has real traffic in it, so it cannot be used to
 * inflate the numbers. In production it requires CRON_SECRET — it writes a
 * thousand rows, and that is not something an anonymous request gets to do.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await backfillHistory();
    return NextResponse.json(result);
  } catch (error) {
    console.error("backfill failed:", error);
    return NextResponse.json(
      { error: "backfill failed — is the scorer running?" },
      { status: 500 },
    );
  }
}
