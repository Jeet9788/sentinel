"use client";

import { motion } from "framer-motion";

import { fadeUp, hoverLift, staggerContainer } from "@/components/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMoney } from "@/lib/format";
import type { Stats } from "@/lib/stats";

type Tile = {
  label: string;
  value: string;
  hint: string;
  color?: string;
};

export function KpiTiles({ stats }: { stats?: Stats }) {
  if (!stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-lg" />
        ))}
      </div>
    );
  }

  const { txns24h, flagged24h, blocked24h, fraudPreventedCents, openCases } = stats.kpis;

  const tiles: Tile[] = [
    {
      label: "Transactions scored",
      value: txns24h.toLocaleString(),
      hint: "last 24 hours",
    },
    {
      label: "Sent to review",
      value: flagged24h.toLocaleString(),
      hint: openCases > 0 ? `${openCases} awaiting an analyst` : "queue clear",
      color: "var(--review)",
    },
    {
      label: "Blocked",
      value: blocked24h.toLocaleString(),
      hint: "no human needed",
      color: "var(--blocked)",
    },
    {
      label: "Fraud prevented",
      value: fmtMoney(fraudPreventedCents),
      // Being explicit beats a flattering number: blocking a real customer is not
      // a save, so only confirmed fraud counts here.
      hint: "confirmed fraud, blocked",
      color: "var(--approved)",
    },
  ];

  return (
    <motion.div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {tiles.map((tile) => (
        <motion.div
          key={tile.label}
          variants={fadeUp}
          whileHover={hoverLift}
          className="panel p-4"
        >
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {tile.label}
          </p>
          <p
            className="mt-2 text-3xl font-semibold tabular-nums"
            style={{ fontFamily: "var(--font-heading)", color: tile.color ?? "var(--foreground)" }}
          >
            {tile.value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{tile.hint}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}
