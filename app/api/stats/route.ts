import { NextResponse } from "next/server";

import { getStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getStats());
  } catch (error) {
    console.error("stats failed:", error);
    return NextResponse.json({ error: "stats failed" }, { status: 500 });
  }
}
