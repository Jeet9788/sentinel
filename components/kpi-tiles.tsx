"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { fadeUp, hoverLift, staggerContainer } from "@/components/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMoney } from "@/lib/format";
import type { Stats } from "@/lib/stats";

type Tile = {
  label: string;
  value: string;
  hint: string;
  color?: string;
  /** Hourly series behind the number — the tile shows its trend, not just a total. */
  series: number[];
  /** Formats the last-hour delta chip (counts by default, money for prevented). */
  fmtDelta?: (n: number) => string;
};

/**
 * KPI tiles on the metric-card pattern: headline figure, a last-hour delta
 * chip, and the metric's own 24h sparkline drawn in its decision color. The
 * delta chip stays neutral — up is not "good" for a blocked count, so only the
 * decision colors carry meaning.
 */
export function KpiTiles({ stats }: { stats?: Stats }) {
  if (!stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[128px] rounded-2xl" />
        ))}
      </div>
    );
  }

  const { txns24h, flagged24h, blocked24h, fraudPreventedCents, openCases } = stats.kpis;
  const traffic = stats.traffic;

  const tiles: Tile[] = [
    {
      label: "Transactions scored",
      value: txns24h.toLocaleString(),
      hint: "last 24 hours",
      series: traffic.map((row) => row.count),
    },
    {
      label: "Sent to review",
      value: flagged24h.toLocaleString(),
      hint: openCases > 0 ? `${openCases} awaiting an analyst` : "queue clear",
      color: "var(--review)",
      series: traffic.map((row) => row.reviews),
    },
    {
      label: "Blocked",
      value: blocked24h.toLocaleString(),
      hint: "no human needed",
      color: "var(--blocked)",
      series: traffic.map((row) => row.blocked),
    },
    {
      label: "Fraud prevented",
      value: fmtMoney(fraudPreventedCents),
      // Being explicit beats a flattering number: blocking a real customer is not
      // a save, so only confirmed fraud counts here.
      hint: "confirmed fraud, blocked",
      color: "var(--approved)",
      series: traffic.map((row) => row.preventedCents),
      fmtDelta: (n) => fmtMoney(Math.abs(n)),
    },
  ];

  return (
    <motion.div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {tiles.map((tile, index) => (
        <motion.div
          key={tile.label}
          variants={fadeUp}
          whileHover={hoverLift}
          className="panel panel-interactive relative overflow-hidden p-4 pb-2"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {tile.label}
            </p>
            <DeltaChip series={tile.series} fmt={tile.fmtDelta} />
          </div>
          <p
            className="mt-2 text-3xl font-semibold tabular-nums"
            style={{ fontFamily: "var(--font-heading)", color: tile.color ?? "var(--foreground)" }}
          >
            {tile.value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{tile.hint}</p>
          <Sparkline id={`kpi-spark-${index}`} series={tile.series} color={tile.color} />
        </motion.div>
      ))}
    </motion.div>
  );
}

/** Last hour vs the hour before. Neutral styling on purpose (see above). */
function DeltaChip({ series, fmt }: { series: number[]; fmt?: (n: number) => string }) {
  if (series.length < 2) return null;
  const step = series[series.length - 1] - series[series.length - 2];
  const Icon = step > 0 ? ArrowUpRight : step < 0 ? ArrowDownRight : Minus;
  const text = (step > 0 ? "+" : step < 0 ? "−" : "") + (fmt ?? String)(Math.abs(step));

  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-foreground/10 bg-foreground/[0.05] px-1.5 py-0.5 text-[10px] text-muted-foreground tabular-nums"
      title="Last hour vs the hour before"
    >
      <Icon className="h-3 w-3" aria-hidden />
      {text}
    </span>
  );
}

/** Decorative 24h trend under the number; the value itself is in the text. */
function Sparkline({ id, series, color }: { id: string; series: number[]; color?: string }) {
  const stroke = color ?? "var(--series)";
  if (series.length < 2 || series.every((v) => v === 0)) {
    return <div className="h-9" aria-hidden />;
  }

  return (
    <div className="mt-1 h-9" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series.map((v) => ({ v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={1.5}
            fill={`url(#${id})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
