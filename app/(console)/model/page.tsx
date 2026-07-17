import { Layers, SlidersHorizontal, Spline, type LucideIcon } from "lucide-react";

import { PrCurveChart } from "@/components/model/pr-curve-chart";
import { ShapChart } from "@/components/model/shap-chart";
import { ThresholdTuner } from "@/components/model/threshold-tuner";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { PanelHead } from "@/components/panel-head";
import { fmtPercent } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import type { ThresholdRow } from "@/lib/threshold-preview";

import metrics from "@/models/v1/metrics.json";
import prCurve from "@/models/v1/pr_curve.json";
import shapSummary from "@/models/v1/shap_summary.json";

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  hint,
  accent = "var(--series)",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="panel relative overflow-hidden p-4">
      {/* Same material language as the dashboard KPI tiles: a lit top edge and
          a corner aura in the stat's accent color. */}
      <div
        aria-hidden
        className="absolute inset-x-4 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          opacity: 0.8,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full blur-3xl"
        style={{ backgroundColor: accent, opacity: 0.12 }}
      />
      <p className="eyebrow relative">{label}</p>
      <p
        className="relative mt-2 text-[34px] font-semibold leading-none tracking-tight tabular"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {value}
      </p>
      {hint && <p className="relative mt-1.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Panel({
  icon,
  color,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  color?: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-5">
      <PanelHead icon={icon} color={color} title={title} description={description} />
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function ModelPage() {
  const { tLow, tHigh } = await getSettings();
  const table = metrics.thresholdTable as ThresholdRow[];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Model card · ${metrics.version}`}
        title="Model"
        description={`${metrics.algorithm}, trained ${new Date(metrics.trainedAt).toLocaleDateString(
          "en-US",
          { year: "numeric", month: "short", day: "numeric" },
        )}.`}
      />

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <Stat label="PR-AUC" value={metrics.prAuc.toFixed(3)} hint="primary metric" />
        </StaggerItem>
        <StaggerItem>
          <Stat label="ROC-AUC" value={metrics.rocAuc.toFixed(3)} hint="secondary" />
        </StaggerItem>
        <StaggerItem>
          <Stat
            label="Fraud rate"
            value={fmtPercent(metrics.dataset.fraudRate, 2)}
            hint={`${metrics.dataset.frauds} of ${metrics.dataset.rows.toLocaleString()}`}
            accent="var(--blocked)"
          />
        </StaggerItem>
        <StaggerItem>
          <Stat
            label="Holdout"
            value={metrics.dataset.testRows.toLocaleString()}
            hint={`${metrics.dataset.testFrauds} frauds, unseen in training`}
            accent="var(--approved)"
          />
        </StaggerItem>
      </Stagger>

      <FadeIn className="panel-inset p-4 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Why PR-AUC, not accuracy.</span> At a{" "}
        {fmtPercent(metrics.dataset.fraudRate, 2)} fraud rate, a model that flags nothing is{" "}
        {fmtPercent(1 - metrics.dataset.fraudRate, 2)} accurate and catches zero fraud. Accuracy and
        ROC-AUC are both flattered by the vast majority of legitimate traffic; precision and recall
        only measure the rare class that matters. {metrics.featureNote}
      </FadeIn>

      <FadeIn className="grid gap-4 lg:grid-cols-2">
        <Panel
          icon={Spline}
          title="Precision–recall curve"
          description="The trade-off the thresholds ride, measured on the holdout"
        >
          <PrCurveChart curve={prCurve} tLow={tLow} tHigh={tHigh} />
        </Panel>

        <Panel
          icon={SlidersHorizontal}
          color="var(--review)"
          title="Threshold policy"
          description="Turn the model's probability into approve / review / block"
        >
          <ThresholdTuner table={table} initialLow={tLow} initialHigh={tHigh} />
        </Panel>
      </FadeIn>

      <FadeIn>
        <Panel
          icon={Layers}
          title="What drives the model"
          description="Exact global SHAP importance over the holdout · top 12 features"
        >
          <ShapChart rows={shapSummary} />
        </Panel>
      </FadeIn>
    </div>
  );
}
