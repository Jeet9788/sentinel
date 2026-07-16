"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

import { fadeUp, staggerContainer } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { CaseDrawer } from "@/components/queue/case-drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMoney, fmtScore, timeAgo } from "@/lib/format";
import type { CaseView } from "@/lib/views";

const POLL_MS = 8_000;

export function QueueView({ tLow, tHigh }: { tLow: number; tHigh: number }) {
  const [cases, setCases] = useState<CaseView[]>();
  const [selected, setSelected] = useState<CaseView | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/cases?status=open", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { items: CaseView[] };
      setCases(body.items);
    } catch {
      setCases((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/cases?status=open", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { items: CaseView[] };
        if (!cancelled) setCases(body.items);
      } catch {
        if (!cancelled) setCases((current) => current ?? []);
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Optimistic removal: a resolved case leaves the list immediately. An empty id
  // is the drawer's rollback signal — refetch and trust the server.
  const handleResolved = useCallback(
    (id: string) => {
      if (!id) {
        load();
        return;
      }
      setResolvedIds((previous) => new Set(previous).add(id));
    },
    [load],
  );

  const visible = (cases ?? []).filter((item) => !resolvedIds.has(item.id));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Human review"
        title="Review queue"
        description="Transactions the model could not settle on its own, riskiest first."
        actions={
          visible.length > 0 ? (
            <span className="eyebrow rounded-full border border-border px-2.5 py-1" style={{ color: "var(--review)" }}>
              {visible.length} open
            </span>
          ) : undefined
        }
      />

      {cases === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="panel px-4 py-16 text-center">
          <p className="text-sm font-medium">Queue clear</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing is waiting for review. New flags will appear here as they come in.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Flagged</th>
                <th className="px-4 py-2.5 font-medium">Merchant</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Card</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-right font-medium">Score</th>
                <th className="px-4 py-2.5 text-right font-medium sr-only">Action</th>
              </tr>
            </thead>
            <motion.tbody variants={staggerContainer} initial="hidden" animate="show">
              {visible.map((item) => (
                <motion.tr
                  key={item.id}
                  variants={fadeUp}
                  whileHover={{ x: 2, transition: { duration: 0.15 } }}
                  onClick={() => setSelected(item)}
                  className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(item.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block">{item.transaction.merchant}</span>
                    <span className="text-xs text-muted-foreground">{item.transaction.city}</span>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground tabular sm:table-cell">
                    •••• {item.transaction.cardLast4}
                  </td>
                  <td className="px-4 py-3 text-right tabular">
                    {fmtMoney(item.transaction.amountCents)}
                  </td>
                  <td
                    className="px-4 py-3 text-right tabular font-medium"
                    style={{ color: "var(--review)" }}
                  >
                    {fmtScore(item.transaction.score)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-muted-foreground">Review →</span>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      )}

      <CaseDrawer
        openCase={selected}
        tLow={tLow}
        tHigh={tHigh}
        onOpenChange={(open) => !open && setSelected(null)}
        onResolved={handleResolved}
      />
    </div>
  );
}
