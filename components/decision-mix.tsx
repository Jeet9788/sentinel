"use client";

import { PieChart } from "lucide-react";

import { MetaChip, PanelHead } from "@/components/panel-head";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtPercent } from "@/lib/format";
import type { Stats } from "@/lib/stats";

/**
 * How the last 24 hours of traffic split across the three decisions: one
 * glowing segmented bar, then each decision as its own small instrument. The
 * point of the product in a single glance — almost everything auto-approved, a
 * sliver to humans, blocking rare and confident.
 */
export function DecisionMix({ stats }: { stats?: Stats }) {
  if (!stats) return <Skeleton className="h-[170px] rounded-2xl" />;

  const { txns24h, flagged24h, blocked24h } = stats.kpis;
  const approved = Math.max(0, txns24h - flagged24h - blocked24h);
  const total = Math.max(1, txns24h);

  const segments = [
    { label: "Approved", value: approved, color: "var(--approved)" },
    { label: "Review", value: flagged24h, color: "var(--review)" },
    { label: "Blocked", value: blocked24h, color: "var(--blocked)" },
  ];

  return (
    <section className="panel p-4">
      <PanelHead
        icon={PieChart}
        title="Decision mix"
        description="Share of decisions"
        meta={<MetaChip>24h</MetaChip>}
      />

      <div
        className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-foreground/[0.06]"
        style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)" }}
      >
        {segments.map(
          (segment) =>
            segment.value > 0 && (
              <div
                key={segment.label}
                // A 1.5% floor keeps the rare-but-critical segments visible: a
                // bar where blocked fraud renders at 0px would defeat the chart.
                style={{
                  width: `${Math.max((segment.value / total) * 100, 1.5)}%`,
                  background: `linear-gradient(180deg, color-mix(in srgb, ${segment.color} 100%, white 12%), ${segment.color})`,
                  boxShadow: `0 0 8px color-mix(in srgb, ${segment.color} 45%, transparent)`,
                }}
              />
            ),
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {segments.map((segment) => (
          <div key={segment.label}>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: segment.color }}
                aria-hidden
              />
              {segment.label}
            </p>
            <p
              className="mt-1 text-xl font-semibold tabular"
              style={{ fontFamily: "var(--font-heading)", color: segment.color }}
            >
              {fmtPercent(segment.value / total, 1)}
            </p>
            <p className="text-[11px] text-muted-foreground tabular">
              {segment.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
