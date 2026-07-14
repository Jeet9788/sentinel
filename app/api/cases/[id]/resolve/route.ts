import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { cases } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  resolution: z.enum(["analyst_approved", "analyst_blocked"]),
  note: z.string().trim().max(500).optional(),
});

/**
 * An analyst's verdict on a flagged transaction.
 *
 * The update is conditional on the case still being open, so two analysts racing
 * on the same case cannot both "win" — the second gets a 409 instead of silently
 * overwriting the first one's decision. Beyond the audit trail, these verdicts
 * are human labels: the raw material a future retraining run would learn from.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "resolution must be analyst_approved or analyst_blocked" }, { status: 400 });
  }

  try {
    const updated = await db
      .update(cases)
      .set({
        status: "resolved",
        resolution: parsed.data.resolution,
        note: parsed.data.note ?? null,
        resolvedAt: new Date(),
      })
      .where(and(eq(cases.id, id), eq(cases.status, "open")))
      .returning();

    if (updated.length === 0) {
      const existing = await db.query.cases.findFirst({ where: eq(cases.id, id) });
      return existing
        ? NextResponse.json({ error: "case already resolved" }, { status: 409 })
        : NextResponse.json({ error: "case not found" }, { status: 404 });
    }

    return NextResponse.json({ case: updated[0] });
  } catch (error) {
    console.error("resolve failed:", error);
    return NextResponse.json({ error: "resolve failed" }, { status: 500 });
  }
}
