"use client";

import { ArrowRight, Inbox } from "lucide-react";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import { usePoll } from "@/components/use-poll";
import { fmtMoney, fmtScore, timeAgo } from "@/lib/format";
import type { TxnView } from "@/lib/views";

type CasesResponse = {
  items: { id: string; transaction: TxnView }[];
};

/**
 * The open review queue, surfaced on the dashboard: the riskiest unresolved
 * cases with a straight line to the queue. An ops overview that never says
 * "here is what needs a human right now" is a chart page, not a console.
 */
export function NeedsAttention() {
  const { data } = usePoll<CasesResponse>("/api/cases?status=open&limit=5", 10_000);

  return (
    <section className="panel flex flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
            Needs attention
          </h2>
          <p className="text-xs text-muted-foreground">Open cases, riskiest first</p>
        </div>
        <Link
          href="/queue"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Queue <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </header>

      {!data ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Queue clear — the model is settling everything on its own.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {data.items.map(({ id, transaction }) => (
            <li key={id}>
              <Link
                href="/queue"
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{transaction.merchant}</p>
                  <p className="text-xs text-muted-foreground">
                    {transaction.city} · {timeAgo(transaction.ts)}
                  </p>
                </div>
                <span className="tabular text-sm">{fmtMoney(transaction.amountCents)}</span>
                <span className="w-14 text-right tabular text-sm" style={{ color: "var(--review)" }}>
                  {fmtScore(transaction.score)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
