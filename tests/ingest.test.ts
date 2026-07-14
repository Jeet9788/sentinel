import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { cases, transactions } from "@/lib/db/schema";
import { makeFeatures, resetTables, setupTestDb } from "./helpers/db";

vi.mock("@/lib/scorer", () => ({ scoreTransaction: vi.fn() }));

const { scoreTransaction } = await import("@/lib/scorer");
const { ingestTransaction } = await import("@/lib/ingest");
const mockScore = vi.mocked(scoreTransaction);

function respondWith(probability: number) {
  mockScore.mockResolvedValue({
    probability,
    modelVersion: "v1",
    topFactors: [{ feature: "V14", label: "pattern component V14", impact: 0.4, direction: "up" }],
  });
}

const input = () => ({
  features: makeFeatures(),
  amountCents: 12_34,
  cardLast4: "4821",
  merchant: "Prime Mart",
  city: "Austin",
});

describe("ingestTransaction", () => {
  beforeAll(() => setupTestDb({ tLow: 0.2, tHigh: 0.8 }));
  beforeEach(async () => {
    await resetTables();
    mockScore.mockReset();
  });

  it("auto-approves a confidently-legitimate transaction without opening a case", async () => {
    respondWith(0.01);
    const result = await ingestTransaction(input());

    expect(result.decision).toBe("approved");
    expect(result.score).toBe(0.01);
    expect(await db.select().from(cases)).toHaveLength(0);
  });

  it("opens a case for a transaction in the uncertain band", async () => {
    respondWith(0.5);
    const result = await ingestTransaction(input());

    expect(result.decision).toBe("review");
    const [openCase] = await db.select().from(cases);
    expect(openCase.transactionId).toBe(result.id);
    expect(openCase.status).toBe("open");
  });

  it("auto-blocks a confidently-fraudulent transaction without a case", async () => {
    respondWith(0.99);
    const result = await ingestTransaction(input());

    expect(result.decision).toBe("blocked");
    expect(await db.select().from(cases)).toHaveLength(0);
  });

  it("routes to a human when the scorer fails, and never silently approves", async () => {
    mockScore.mockRejectedValue(new Error("scorer unreachable"));
    const result = await ingestTransaction(input());

    expect(result.decision).toBe("review");
    expect(result.scoringError).toBe(true);
    expect(result.score).toBeNull();

    const [row] = await db.select().from(transactions);
    expect(row.scoringError).toBe(true);
    expect(row.score).toBeNull();
    expect(await db.select().from(cases)).toHaveLength(1);
  });

  it("is idempotent: a retried transaction is not double-counted", async () => {
    respondWith(0.5);
    const id = crypto.randomUUID();

    const first = await ingestTransaction({ ...input(), id });
    const second = await ingestTransaction({ ...input(), id });

    expect(second.id).toBe(first.id);
    expect(second.decision).toBe(first.decision);
    expect(await db.select().from(transactions)).toHaveLength(1);
    expect(await db.select().from(cases)).toHaveLength(1);
    // The retry must not re-score: that would be a wasted inference, and worse,
    // could produce a different decision for a transaction already acted on.
    expect(mockScore).toHaveBeenCalledTimes(1);
  });

  it("persists the explanation alongside the score", async () => {
    respondWith(0.5);
    const result = await ingestTransaction(input());

    const [row] = await db.select().from(transactions).where(eq(transactions.id, result.id));
    expect(row.topFactors?.[0].feature).toBe("V14");
    expect(row.modelVersion).toBe("v1");
  });
});
