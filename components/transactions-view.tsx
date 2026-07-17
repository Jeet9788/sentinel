"use client";

import { Receipt, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { DecisionBadge } from "@/components/decision-badge";
import { FadeIn } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { MetaChip, PanelHead } from "@/components/panel-head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Decision } from "@/lib/decision";
import { DECISION_COLOR, fmtMoney, fmtScore, timeAgo } from "@/lib/format";
import type { TxnView } from "@/lib/views";

type DecisionFilter = "all" | Decision;

const FILTERS: { value: DecisionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "review", label: "Review" },
  { value: "blocked", label: "Blocked" },
];

export function TransactionsView() {
  const [decision, setDecision] = useState<DecisionFilter>("all");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<TxnView[]>();
  const [cursor, setCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const buildUrl = useCallback(
    (after?: number) => {
      const params = new URLSearchParams({ limit: "25" });
      if (decision !== "all") params.set("decision", decision);
      if (debounced) params.set("q", debounced);
      if (after) params.set("cursor", String(after));
      return `/api/transactions?${params}`;
    },
    [decision, debounced],
  );

  // Reload from the top whenever the filter or search changes. reqId guards
  // against a slow earlier request landing after a newer one.
  useEffect(() => {
    const id = ++reqId.current;
    (async () => {
      setRows(undefined);
      try {
        const response = await fetch(buildUrl(), { cache: "no-store" });
        const body = (await response.json()) as { items: TxnView[]; nextCursor: number | null };
        if (reqId.current !== id) return;
        setRows(body.items);
        setCursor(body.nextCursor);
      } catch {
        if (reqId.current === id) setRows([]);
      }
    })();
  }, [buildUrl]);

  const loadMore = async () => {
    if (cursor === null) return;
    setLoadingMore(true);
    try {
      const response = await fetch(buildUrl(cursor), { cache: "no-store" });
      const body = (await response.json()) as { items: TxnView[]; nextCursor: number | null };
      setRows((current) => [...(current ?? []), ...body.items]);
      setCursor(body.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Ledger"
        title="Transactions"
        description="Every scored transaction, filterable and searchable."
        actions={rows ? <MetaChip>{rows.length} loaded</MetaChip> : undefined}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-foreground/10 bg-foreground/[0.04] p-0.5">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setDecision(filter.value)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors ${
                decision === filter.value
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter.value !== "all" && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: DECISION_COLOR[filter.value] }}
                  aria-hidden
                />
              )}
              {filter.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search merchant or card"
            className="pl-8"
          />
        </div>
      </div>

      <FadeIn className="overflow-hidden panel">
        <header className="border-b border-border px-4 py-3">
          <PanelHead
            icon={Receipt}
            title="Ledger entries"
            description="Newest first · every score is a real out-of-sample prediction"
          />
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">Merchant</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Card</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-right font-medium">Score</th>
                <th className="px-4 py-2.5 font-medium">Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows === undefined ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-muted-foreground">
                    No transactions match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {timeAgo(row.ts)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block">{row.merchant}</span>
                      <span className="text-xs text-muted-foreground">{row.city}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground tabular md:table-cell">
                      •••• {row.cardLast4}
                    </td>
                    <td className="px-4 py-3 text-right tabular">{fmtMoney(row.amountCents)}</td>
                    <td
                      className="px-4 py-3 text-right tabular"
                      style={{ color: DECISION_COLOR[row.decision] }}
                    >
                      {fmtScore(row.score)}
                    </td>
                    <td className="px-4 py-3">
                      <DecisionBadge decision={row.decision} scoringError={row.scoringError} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {cursor !== null && rows && rows.length > 0 && (
          <div className="border-t border-border p-3 text-center">
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </FadeIn>
    </div>
  );
}
