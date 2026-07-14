import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * The thresholds are the live policy of the system, so they are validated on the
 * server and never trusted from the client. An inverted pair (tLow >= tHigh)
 * would make the review band empty and quietly turn a human-in-the-loop system
 * into a fully automatic one.
 */
const updateSchema = z
  .object({
    tLow: z.number().min(0).max(1),
    tHigh: z.number().min(0).max(1),
    simBatchMin: z.number().int().min(1).max(20).optional(),
    simBatchMax: z.number().int().min(1).max(20).optional(),
    simMinIntervalSeconds: z.number().int().min(5).max(300).optional(),
  })
  .refine((s) => s.tLow < s.tHigh, { message: "tLow must be less than tHigh" })
  .refine((s) => (s.simBatchMin ?? 1) <= (s.simBatchMax ?? 20), {
    message: "simBatchMin must not exceed simBatchMax",
  });

export async function GET() {
  try {
    const row = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
    if (!row) {
      return NextResponse.json({ error: "settings not seeded" }, { status: 500 });
    }
    return NextResponse.json(row);
  } catch (error) {
    console.error("settings read failed:", error);
    return NextResponse.json({ error: "settings read failed" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const [row] = await db
      .update(settings)
      .set(parsed.data)
      .where(eq(settings.id, 1))
      .returning();

    return NextResponse.json(row);
  } catch (error) {
    console.error("settings update failed:", error);
    return NextResponse.json({ error: "settings update failed" }, { status: 500 });
  }
}
