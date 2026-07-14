"use client";

import { TrafficChart } from "@/components/charts/traffic-chart";
import { ScoreHistogram } from "@/components/charts/score-histogram";
import { KpiTiles } from "@/components/kpi-tiles";
import { LiveFeed } from "@/components/live-feed";
import { usePoll } from "@/components/use-poll";
import type { Stats } from "@/lib/stats";

export function Overview({ tLow, tHigh }: { tLow: number; tHigh: number }) {
  const { data: stats, stale } = usePoll<Stats>("/api/stats", 10_000);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
            Overview
          </h1>
          <p className="text-sm text-muted-foreground">
            Every transaction scored on arrival. The model settles what it can; the rest goes to
            a human.
          </p>
        </div>
        {stale && <span className="text-xs text-muted-foreground">Reconnecting…</span>}
      </div>

      <KpiTiles stats={stats} />

      <div className="grid gap-4 lg:grid-cols-2">
        <TrafficChart stats={stats} />
        <ScoreHistogram stats={stats} tLow={tLow} tHigh={tHigh} />
      </div>

      <LiveFeed />
    </div>
  );
}
