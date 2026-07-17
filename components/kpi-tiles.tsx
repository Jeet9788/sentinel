"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  Inbox,
  Minus,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { AnimatedNumber } from "@/components/animated-number";
import { fadeUp, hoverLift, staggerContainer } from "@/components/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMoney } from "@/lib/format";
import type { Stats } from "@/lib/stats";

type Tile = {
  label: string;
  icon: LucideIcon;
  value: number;
  format?: (n: number) => string;
  hint: string;
  color: string;
  numberColor?: string;
  /** Hourly series behind the number — the tile shows its trend, not just a total. */
  series: number[];
  /** Formats the last-hour delta chip (counts by default, money for prevented). */
  fmtDelta?: (n: number) => string;
};

/**
 * KPI tiles with a full card anatomy: a tinted icon naming the metric, a mono
 * eyebrow, an animated display numeral, a neutral last-hour delta chip, and the
 * metric's own glowing 24h sparkline. Each card carries its decision color as
 * material — a top hairline and a corner aura — so the row reads as four
 * distinct instruments, not four grey boxes.
 */
export function KpiTiles({ stats }: { stats?: Stats }) {
  if (!stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[148px] rounded-2xl" />
        ))}
      </div>
    );
  }

  const { txns24h, flagged24h, blocked24h, fraudPreventedCents, openCases } = stats.kpis;
  const traffic = stats.traffic;

  const tiles: Tile[] = [
    {
      label: "Transactions scored",
      icon: Activity,
      value: txns24h,
      hint: "last 24 hours",
      color: "var(--series)",
      numberColor: "var(--foreground)",
      series: traffic.map((row) => row.count),
    },
    {
      label: "Sent to review",
      icon: Inbox,
      value: flagged24h,
      hint: openCases > 0 ? `${openCases} awaiting an analyst` : "queue clear",
      color: "var(--review)",
      series: traffic.map((row) => row.reviews),
    },
    {
      label: "Blocked",
      icon: Ban,
      value: blocked24h,
      hint: "no human needed",
      color: "var(--blocked)",
      series: traffic.map((row) => row.blocked),
    },
    {
      label: "Fraud prevented",
      icon: ShieldCheck,
      value: fraudPreventedCents,
      format: fmtMoney,
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
          {/* The card's color as material: a lit top edge and a corner aura. */}
          <div
            aria-hidden
            className="absolute inset-x-4 top-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${tile.color}, transparent)`,
              opacity: 0.8,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full blur-3xl"
            style={{ backgroundColor: tile.color, opacity: 0.14 }}
          />

          <div className="relative flex items-center justify-between gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg border"
              style={{
                color: tile.color,
                backgroundColor: `color-mix(in srgb, ${tile.color} 12%, transparent)`,
                borderColor: `color-mix(in srgb, ${tile.color} 28%, transparent)`,
              }}
              aria-hidden
            >
              <tile.icon className="h-3.5 w-3.5" />
            </span>
            <DeltaChip series={tile.series} fmt={tile.fmtDelta} />
          </div>

          <p className="eyebrow relative mt-3">{tile.label}</p>
          <p
            className="relative mt-1 text-[34px] font-semibold leading-none tracking-tight tabular-nums"
            style={{ fontFamily: "var(--font-heading)", color: tile.numberColor ?? tile.color }}
          >
            <AnimatedNumber value={tile.value} format={tile.format} />
          </p>
          <p className="relative mt-1.5 text-xs text-muted-foreground">{tile.hint}</p>

          <Sparkline id={`kpi-spark-${index}`} series={tile.series} color={tile.color} />
        </motion.div>
      ))}
    </motion.div>
  );
}

/** Last hour vs the hour before. Neutral styling on purpose — up is not "good"
 * for a blocked count, so only the decision colors carry meaning. */
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
function Sparkline({ id, series, color }: { id: string; series: number[]; color: string }) {
  if (series.length < 2 || series.every((v) => v === 0)) {
    return <div className="h-9" aria-hidden />;
  }

  return (
    <div
      className="mt-1 h-9"
      style={{ filter: `drop-shadow(0 0 5px color-mix(in srgb, ${color} 55%, transparent))` }}
      aria-hidden
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series.map((v) => ({ v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
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
