"use client";

import { TrafficChart } from "@/components/charts/traffic-chart";
import { ScoreHistogram } from "@/components/charts/score-histogram";
import { KpiTiles } from "@/components/kpi-tiles";
import { LiveFeed } from "@/components/live-feed";
import { FadeIn } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { usePoll } from "@/components/use-poll";
import type { Stats } from "@/lib/stats";

export function Overview({ tLow, tHigh }: { tLow: number; tHigh: number }) {
  const { data: stats, stale } = usePoll<Stats>("/api/stats", 10_000);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Live operations"
        title="Overview"
        description="Every transaction scored on arrival. The model settles what it can; the rest goes to a human."
        actions={
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className="pulse-dot h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: stale ? "var(--review)" : "var(--approved)" }}
            />
            {stale ? "Reconnecting…" : "Live"}
          </span>
        }
      />

      <KpiTiles stats={stats} />

      <FadeIn className="grid gap-5 lg:grid-cols-2">
        <TrafficChart stats={stats} />
        <ScoreHistogram stats={stats} tLow={tLow} tHigh={tHigh} />
      </FadeIn>

      <FadeIn>
        <LiveFeed />
      </FadeIn>
    </div>
  );
}
