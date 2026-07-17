"use client";

import { TrafficChart } from "@/components/charts/traffic-chart";
import { ScoreHistogram } from "@/components/charts/score-histogram";
import { DecisionMix } from "@/components/decision-mix";
import { KpiTiles } from "@/components/kpi-tiles";
import { LiveFeed } from "@/components/live-feed";
import { ModelSnapshot } from "@/components/model-snapshot";
import { FadeIn } from "@/components/motion";
import { NeedsAttention } from "@/components/needs-attention";
import { PageHeader } from "@/components/page-header";
import { usePoll } from "@/components/use-poll";
import type { Stats } from "@/lib/stats";

/**
 * The ops console layout: KPI strip, then an asymmetric grid — the two big
 * charts carry the left two-thirds, and the right rail answers the operator's
 * three standing questions: how is traffic splitting, what needs a human, and
 * what model is deciding all of this. The live feed runs full-width below.
 */
export function Overview({
  tLow,
  tHigh,
  prAuc,
  rocAuc,
}: {
  tLow: number;
  tHigh: number;
  prAuc: number;
  rocAuc: number;
}) {
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

      <FadeIn className="grid gap-5 lg:grid-cols-3">
        <TrafficChart stats={stats} className="lg:col-span-2" />
        <div className="flex flex-col gap-5">
          <DecisionMix stats={stats} />
          <ModelSnapshot prAuc={prAuc} rocAuc={rocAuc} tLow={tLow} tHigh={tHigh} />
        </div>
        <ScoreHistogram stats={stats} tLow={tLow} tHigh={tHigh} className="lg:col-span-2" />
        <NeedsAttention />
      </FadeIn>

      <FadeIn>
        <LiveFeed />
      </FadeIn>
    </div>
  );
}
