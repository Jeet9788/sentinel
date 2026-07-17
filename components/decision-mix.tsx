"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { fmtPercent } from "@/lib/format";
import type { Stats } from "@/lib/stats";

/**
 * How the last 24 hours of traffic split across the three decisions, as one
 * segmented bar. The point of the product in a single glance: almost everything
 * is auto-approved, a sliver goes to humans, and blocking is rare and confident.
 */
export function DecisionMix({ stats }: { stats?: Stats }) {
  if (!stats) return <Skeleton className="h-[150px] rounded-2xl" />;

  const { txns24h, flagged24h, blocked24h } = stats.kpis;
  const approved = Math.max(0, txns24h - flagged24h - blocked24h);
  const total = Math.max(1, txns24h);

  const segments = [
    { label: "Auto-approved", value: approved, color: "var(--approved)" },
    { label: "To review", value: flagged24h, color: "var(--review)" },
    { label: "Blocked", value: blocked24h, color: "var(--blocked)" },
  ];

  return (
    <section className="panel p-4">
      <h2 className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
        Decision mix
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">Last 24 hours, share of decisions</p>

      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
        {segments.map(
          (segment) =>
            segment.value > 0 && (
              <div
                key={segment.label}
                // A 1.5% floor keeps the rare-but-critical segments visible: a
                // bar where blocked fraud renders at 0px would defeat the chart.
                style={{
                  width: `${Math.max((segment.value / total) * 100, 1.5)}%`,
                  backgroundColor: segment.color,
                }}
              />
            ),
        )}
      </div>

      <ul className="mt-3 space-y-1.5">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2 text-xs">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
              aria-hidden
            />
            <span className="text-muted-foreground">{segment.label}</span>
            <span className="ml-auto tabular">{segment.value.toLocaleString()}</span>
            <span className="w-12 text-right tabular text-muted-foreground">
              {fmtPercent(segment.value / total, 1)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
