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
