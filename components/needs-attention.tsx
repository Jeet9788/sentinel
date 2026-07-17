"use client";

import { ArrowRight, ChevronRight, Inbox } from "lucide-react";
import Link from "next/link";

import { MetaChip, PanelHead } from "@/components/panel-head";
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
    <section className="panel flex flex-col overflow-hidden">
      <header className="border-b border-border px-4 py-3">
        <PanelHead
          icon={Inbox}
          color="var(--review)"
          title="Needs attention"
          description="Open cases, riskiest first"
          meta={
            <>
              {data && data.items.length > 0 && (
                <MetaChip color="var(--review)">{data.items.length} open</MetaChip>
              )}
              <Link
                href="/queue"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Queue <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </>
          }
        />
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
                className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{transaction.merchant}</p>
                  <p className="text-xs text-muted-foreground">
                    {transaction.city} · {timeAgo(transaction.ts)}
                  </p>
                </div>
                <span className="tabular text-sm">{fmtMoney(transaction.amountCents)}</span>
                <span
                  className="rounded-md px-1.5 py-0.5 text-xs tabular"
                  style={{
                    color: "var(--review)",
                    backgroundColor: "color-mix(in srgb, var(--review) 14%, transparent)",
                  }}
                >
                  {fmtScore(transaction.score)}
                </span>
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
