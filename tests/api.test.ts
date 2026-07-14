import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { cases, replayPool, settings, transactions } from "@/lib/db/schema";
import { makeFeatures, resetTables, setupTestDb } from "./helpers/db";

vi.mock("@/lib/scorer", () => ({ scoreTransaction: vi.fn() }));

const { scoreTransaction } = await import("@/lib/scorer");
const mockScore = vi.mocked(scoreTransaction);

const { POST: tickRoute } = await import("@/app/api/simulate/tick/route");
const { POST: burstRoute } = await import("@/app/api/simulate/burst/route");
const { GET: feedRoute } = await import("@/app/api/feed/route");
const { GET: statsRoute } = await import("@/app/api/stats/route");
const { GET: casesRoute } = await import("@/app/api/cases/route");
const { POST: resolveRoute } = await import("@/app/api/cases/[id]/resolve/route");
const { GET: getSettings, PUT: putSettings } = await import("@/app/api/settings/route");
const { GET: transactionsRoute } = await import("@/app/api/transactions/route");
const { GET: cleanupRoute } = await import("@/app/api/cron/cleanup/route");

/** Route handlers take a NextRequest (they read `.nextUrl`), so tests must too. */
type NextInit = ConstructorParameters<typeof NextRequest>[1];
const req = (url: string, init?: NextInit) => new NextRequest(url, init);

/** Fraud scores high, legitimate scores ~0 — enough for the routing under test. */
function scoreByTruth() {
  let call = 0;
  mockScore.mockImplementation(async (features: number[]) => {
    // The seeded pool below encodes "is fraud" in the first feature.
    const probability = features[0] > 0.5 ? 0.99 : 0.001;
    call += 1;
    return {
      probability,
      modelVersion: "v1",
      topFactors: [{ feature: "V14", label: "pattern component V14", impact: 0.5, direction: "up" as const }],
    };
  });
  return () => call;
}

async function seedPool(legit: number, fraud: number) {
  const rows = [
    ...Array.from({ length: legit }, (_, i) => ({
      features: makeFeatures(0),
      amountCents: 1000 + i,
      isFraud: false,
      cardLast4: "1111",
      merchant: "Prime Mart",
      city: "Austin",
    })),
    ...Array.from({ length: fraud }, (_, i) => ({
      features: makeFeatures(1),
      amountCents: 90_000 + i,
      isFraud: true,
      cardLast4: "9999",
      merchant: "Quartz Jewelers",
      city: "Miami",
    })),
  ];
  await db.insert(replayPool).values(rows);
}

describe("api routes", () => {
  beforeAll(() => setupTestDb({ tLow: 0.2, tHigh: 0.8 }));

  beforeEach(async () => {
    await resetTables();
    await db.update(settings).set({ lastTickAt: null, tLow: 0.2, tHigh: 0.8 }).where(eq(settings.id, 1));
    mockScore.mockReset();
    scoreByTruth();
    await seedPool(40, 10);
  });

  describe("simulator", () => {
    it("ingests a batch on tick", async () => {
      const body = await (await tickRoute()).json();

      expect(body.skipped).toBe(false);
      expect(body.ingested).toBeGreaterThan(0);
      expect(await db.select().from(transactions)).toHaveLength(body.ingested);
    });

    it("throttles a second tick inside the interval, however many tabs are open", async () => {
      await tickRoute();
      const countAfterFirst = (await db.select().from(transactions)).length;

      const [second, third] = await Promise.all([tickRoute(), tickRoute()]);
      const bodies = [await second.json(), await third.json()];

      expect(bodies.every((b) => b.skipped)).toBe(true);
      expect(await db.select().from(transactions)).toHaveLength(countAfterFirst);
    });

    it("guarantees fraud in a demo burst, and blocks it", async () => {
      const body = await (await burstRoute()).json();
      expect(body.ingested).toBe(10);

      const rows = await db.select().from(transactions);
      const frauds = rows.filter((r) => r.isFraudTruth);
      expect(frauds.length).toBeGreaterThanOrEqual(3);
      expect(frauds.every((r) => r.decision === "blocked")).toBe(true);
    });
  });

  describe("feed", () => {
    it("returns only rows newer than the cursor", async () => {
      await burstRoute();
      const first = await (await feedRoute(req("http://t/api/feed"))).json();
      expect(first.items).toHaveLength(10);

      const empty = await (await feedRoute(req(`http://t/api/feed?after=${first.cursor}`))).json();
      expect(empty.items).toHaveLength(0);

      await burstRoute();
      const next = await (await feedRoute(req(`http://t/api/feed?after=${first.cursor}`))).json();
      expect(next.items).toHaveLength(10);
      expect(next.items.every((t: { seq: number }) => t.seq > first.cursor)).toBe(true);
    });

    it("never leaks the raw feature vector to the client", async () => {
      await burstRoute();
      const body = await (await feedRoute(req("http://t/api/feed"))).json();
      expect(body.items[0]).not.toHaveProperty("features");
      expect(body.items[0].amount).toBeCloseTo(body.items[0].amountCents / 100);
    });
  });

  describe("stats", () => {
    it("counts prevented fraud only for blocked transactions that really were fraud", async () => {
      await burstRoute();
      const body = await (await statsRoute()).json();

      const blockedFrauds = (await db.select().from(transactions)).filter(
        (t) => t.decision === "blocked" && t.isFraudTruth,
      );
      const expected = blockedFrauds.reduce((sum, t) => sum + t.amountCents, 0);

      expect(body.kpis.fraudPreventedCents).toBe(expected);
      expect(body.kpis.txns24h).toBe(10);
      expect(body.histogram).toHaveLength(20);
    });
  });

  describe("cases", () => {
    it("resolves an open case once, then refuses to resolve it again", async () => {
      // Force a review by putting the whole score range in the review band.
      await db.update(settings).set({ tLow: 0.0001, tHigh: 0.999999 }).where(eq(settings.id, 1));
      await burstRoute();

      const queue = await (await casesRoute(req("http://t/api/cases?status=open"))).json();
      expect(queue.items.length).toBeGreaterThan(0);
      const target = queue.items[0];
      expect(target.transaction).not.toHaveProperty("features");

      const params = Promise.resolve({ id: target.id });
      const ok = await resolveRoute(
        req("http://t/x", {
          method: "POST",
          body: JSON.stringify({ resolution: "analyst_blocked", note: "confirmed fraud" }),
        }),
        { params },
      );
      expect(ok.status).toBe(200);

      const [row] = await db.select().from(cases).where(eq(cases.id, target.id));
      expect(row.status).toBe("resolved");
      expect(row.resolution).toBe("analyst_blocked");
      expect(row.note).toBe("confirmed fraud");
      expect(row.resolvedAt).not.toBeNull();

      const again = await resolveRoute(
        req("http://t/x", { method: "POST", body: JSON.stringify({ resolution: "analyst_approved" }) }),
        { params: Promise.resolve({ id: target.id }) },
      );
      expect(again.status).toBe(409);
    });

    it("404s an unknown case", async () => {
      const res = await resolveRoute(
        req("http://t/x", { method: "POST", body: JSON.stringify({ resolution: "analyst_approved" }) }),
        { params: Promise.resolve({ id: crypto.randomUUID() }) },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("settings", () => {
    it("accepts a valid threshold change", async () => {
      const res = await putSettings(
        req("http://t/api/settings", { method: "PUT", body: JSON.stringify({ tLow: 0.1, tHigh: 0.9 }) }),
      );
      expect(res.status).toBe(200);

      const body = await (await getSettings()).json();
      expect(body.tLow).toBeCloseTo(0.1);
      expect(body.tHigh).toBeCloseTo(0.9);
    });

    it("rejects an inverted band that would eliminate human review", async () => {
      const res = await putSettings(
        req("http://t/api/settings", { method: "PUT", body: JSON.stringify({ tLow: 0.9, tHigh: 0.2 }) }),
      );
      expect(res.status).toBe(400);

      const unchanged = await (await getSettings()).json();
      expect(unchanged.tLow).toBeCloseTo(0.2);
    });

    it("rejects out-of-range thresholds", async () => {
      const res = await putSettings(
        req("http://t/api/settings", { method: "PUT", body: JSON.stringify({ tLow: -1, tHigh: 2 }) }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("cleanup cron", () => {
    it("refuses to delete anything without the cron secret", async () => {
      vi.stubEnv("CRON_SECRET", "topsecret");
      await burstRoute();

      const denied = await cleanupRoute(req("http://t/api/cron/cleanup"));
      expect(denied.status).toBe(401);

      const wrongSecret = await cleanupRoute(
        req("http://t/api/cron/cleanup", { headers: { authorization: "Bearer guess" } }),
      );
      expect(wrongSecret.status).toBe(401);
      expect(await db.select().from(transactions)).toHaveLength(10);

      vi.unstubAllEnvs();
    });

    it("deletes transactions past the retention window and keeps fresh ones", async () => {
      vi.stubEnv("CRON_SECRET", "topsecret");
      await burstRoute();

      const [old] = await db.select().from(transactions).limit(1);
      await db
        .update(transactions)
        .set({ createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000) })
        .where(eq(transactions.id, old.id));

      const res = await cleanupRoute(
        req("http://t/api/cron/cleanup", { headers: { authorization: "Bearer topsecret" } }),
      );
      expect(res.status).toBe(200);
      expect((await res.json()).deleted).toBe(1);

      const remaining = await db.select().from(transactions);
      expect(remaining).toHaveLength(9);
      expect(remaining.find((t) => t.id === old.id)).toBeUndefined();

      vi.unstubAllEnvs();
    });
  });

  describe("transactions ledger", () => {
    it("filters by decision and paginates", async () => {
      await burstRoute();

      const blocked = await (
        await transactionsRoute(req("http://t/api/transactions?decision=blocked"))
      ).json();
      expect(blocked.items.length).toBeGreaterThan(0);
      expect(blocked.items.every((t: { decision: string }) => t.decision === "blocked")).toBe(true);

      const page = await (await transactionsRoute(req("http://t/api/transactions?limit=4"))).json();
      expect(page.items).toHaveLength(4);
      expect(page.nextCursor).toBeTypeOf("number");

      const next = await (
        await transactionsRoute(req(`http://t/api/transactions?limit=4&cursor=${page.nextCursor}`))
      ).json();
      expect(next.items.every((t: { seq: number }) => t.seq < page.nextCursor)).toBe(true);
    });

    it("searches by merchant", async () => {
      await burstRoute();
      const body = await (
        await transactionsRoute(req("http://t/api/transactions?q=Quartz"))
      ).json();
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.items.every((t: { merchant: string }) => t.merchant.includes("Quartz"))).toBe(true);
    });
  });
});
