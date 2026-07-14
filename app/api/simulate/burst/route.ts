import { NextResponse } from "next/server";

import { burst } from "@/lib/simulate";

export const dynamic = "force-dynamic";

/** The demo button. Fixed, capped batch size — see MAX_BURST. */
export async function POST() {
  try {
    return NextResponse.json(await burst());
  } catch (error) {
    console.error("burst failed:", error);
    return NextResponse.json({ error: "burst failed" }, { status: 500 });
  }
}
