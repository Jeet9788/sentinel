import { NextResponse } from "next/server";

import { tick } from "@/lib/simulate";

export const dynamic = "force-dynamic";

/**
 * Driven by the dashboard while someone is watching, not by a cron. Vercel's
 * Hobby plan runs crons at most once a day, and simulating traffic nobody is
 * looking at would burn compute to no purpose. The server-side throttle means
 * the stream advances at a fixed rate no matter how many tabs are open.
 */
export async function POST() {
  try {
    return NextResponse.json(await tick());
  } catch (error) {
    console.error("tick failed:", error);
    return NextResponse.json({ error: "tick failed" }, { status: 500 });
  }
}
