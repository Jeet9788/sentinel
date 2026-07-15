import type { Transaction } from "@/lib/db/schema";

/**
 * What the client is allowed to see. The 29 raw model features are deliberately
 * not in here: they are meaningless to a human, and shipping them on every feed
 * poll would be pure payload weight.
 */
export type TxnView = Omit<Transaction, "features" | "ts" | "createdAt"> & {
  ts: string;
  createdAt: string;
  amount: number;
};

export function toTxnView(row: Transaction): TxnView {
  const { features: _features, ts, createdAt, ...rest } = row;
  return {
    ...rest,
    ts: ts.toISOString(),
    createdAt: createdAt.toISOString(),
    amount: row.amountCents / 100,
  };
}

/** A review-queue case joined to the transaction that raised it. Matches the shape of GET /api/cases. */
export type CaseView = {
  id: string;
  status: "open" | "resolved";
  resolution: "analyst_approved" | "analyst_blocked" | null;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
  transaction: TxnView;
};
