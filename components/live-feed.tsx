"use client";

import { Pause, Play, Radio } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DecisionBadge } from "@/components/decision-badge";
import { PanelHead } from "@/components/panel-head";
import { Skeleton } from "@/components/ui/skeleton";
import { DECISION_COLOR, fmtMoney, fmtScore, timeAgo } from "@/lib/format";
import type { TxnView } from "@/lib/views";

const MAX_ROWS = 25;
const POLL_MS = 4_000;

type Feed = { items: TxnView[]; cursor: number };

/**
 * The live authorization stream. Rows arrive newest-first and announce themselves
 * once with a tint of their decision color, so a blocked transaction is visible
 * from across the room before anyone reads it.
 */
export function LiveFeed() {
  const [rows, setRows] = useState<TxnView[]>([]);
  const [arrived, setArrived] = useState<Set<string>>(new Set());
  const [stale, setStale] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Moving content must be stoppable (WCAG 2.2.2). Pausing stops the polling;
  // the cursor survives, so resuming catches up rather than losing rows.
  const [paused, setPaused] = useState(false);
  const cursor = useRef(0);

  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let backoff = POLL_MS;

    const poll = async () => {
      try {
        const url = cursor.current > 0 ? `/api/feed?after=${cursor.current}` : "/api/feed";
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const feed = (await response.json()) as Feed;
        if (cancelled) return;

        if (feed.items.length > 0) {
          cursor.current = Math.max(cursor.current, feed.cursor);
          setRows((previous) => [...feed.items, ...previous].slice(0, MAX_ROWS));
          setArrived(new Set(feed.items.map((item) => item.id)));
        }
        setStale(false);
        setLoaded(true);
        backoff = POLL_MS;
      } catch {
        if (cancelled) return;
        setStale(true);
        backoff = Math.min(backoff * 2, 60_000);
      }
      if (!cancelled) timer = setTimeout(poll, backoff);
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [paused]);

  return (
    <section className="panel">
      <header className="border-b border-border px-4 py-3">
        <PanelHead
          icon={Radio}
          color="var(--approved)"
          title="Live authorizations"
          description="Scored on arrival, newest first"
          meta={
            <>
              {stale && !paused && (
                <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                  Reconnecting…
                </span>
              )}
              {!paused && !stale && (
                <span
                  className="eyebrow inline-flex items-center gap-1.5 rounded-full border px-2 py-1"
                  style={{
                    color: "var(--approved)",
                    borderColor: "color-mix(in srgb, var(--approved) 30%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--approved) 10%, transparent)",
                  }}
                >
                  <span
                    className="pulse-dot h-1 w-1 rounded-full"
                    style={{ backgroundColor: "var(--approved)" }}
                    aria-hidden
                  />
                  Live
                </span>
              )}
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-pressed={paused}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.05] px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                {paused ? (
                  <>
                    <Play className="h-3 w-3" aria-hidden /> Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-3 w-3" aria-hidden /> Pause
                  </>
                )}
              </button>
            </>
          }
        />
      </header>

      {!loaded ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          No transactions yet. The stream advances every few seconds — or inject a burst to see
          the system catch fraud now.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Merchant</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">Card</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 text-right font-medium">Score</th>
                <th className="px-4 py-2 font-medium">Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-border/60 ${arrived.has(row.id) ? "row-arrive" : ""}`}
                  style={{ ["--row-tint" as string]: DECISION_COLOR[row.decision] }}
                >
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(row.ts)}
                  </td>
                  <td className="px-4 py-2">
                    <span className="block max-w-[14ch] truncate sm:max-w-none">{row.merchant}</span>
                    <span className="text-xs text-muted-foreground">{row.city}</span>
                  </td>
                  <td className="hidden px-4 py-2 text-muted-foreground tabular sm:table-cell">
                    •••• {row.cardLast4}
                  </td>
                  <td className="px-4 py-2 text-right tabular">{fmtMoney(row.amountCents)}</td>
                  <td
                    className="px-4 py-2 text-right tabular"
                    style={{ color: DECISION_COLOR[row.decision] }}
                  >
                    {fmtScore(row.score)}
                  </td>
                  <td className="px-4 py-2">
                    <DecisionBadge decision={row.decision} scoringError={row.scoringError} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
