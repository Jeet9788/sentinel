import { PrCurveChart } from "@/components/model/pr-curve-chart";
import { ShapChart } from "@/components/model/shap-chart";
import { ThresholdTuner } from "@/components/model/threshold-tuner";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { fmtPercent } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import type { ThresholdRow } from "@/lib/threshold-preview";

import metrics from "@/models/v1/metrics.json";
import prCurve from "@/models/v1/pr_curve.json";
import shapSummary from "@/models/v1/shap_summary.json";

export const dynamic = "force-dynamic";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className="mt-1 text-2xl font-semibold tabular"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
        {title}
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

export default async function ModelPage() {
  const { tLow, tHigh } = await getSettings();
  const table = metrics.thresholdTable as ThresholdRow[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
          Model
        </h1>
        <p className="text-sm text-muted-foreground">
          {metrics.algorithm}, version {metrics.version} · trained{" "}
          {new Date(metrics.trainedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>

      <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          />
        </StaggerItem>
        <StaggerItem>
          <Stat
            label="Holdout"
            value={metrics.dataset.testRows.toLocaleString()}
            hint={`${metrics.dataset.testFrauds} frauds, unseen in training`}
          />
        </StaggerItem>
      </Stagger>

      <FadeIn className="rounded-lg border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Why PR-AUC, not accuracy.</span> At a{" "}
        {fmtPercent(metrics.dataset.fraudRate, 2)} fraud rate, a model that flags nothing is{" "}
        {fmtPercent(1 - metrics.dataset.fraudRate, 2)} accurate and catches zero fraud. Accuracy and
        ROC-AUC are both flattered by the vast majority of legitimate traffic; precision and recall
        only measure the rare class that matters. {metrics.featureNote}
      </FadeIn>

      <FadeIn className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Precision–recall curve"
          description="The trade-off the thresholds ride, measured on the holdout"
        >
          <PrCurveChart curve={prCurve} tLow={tLow} tHigh={tHigh} />
        </Panel>

        <Panel
          title="Threshold policy"
          description="Turn the model's probability into approve / review / block"
        >
          <ThresholdTuner table={table} initialLow={tLow} initialHigh={tHigh} />
        </Panel>
      </FadeIn>

      <FadeIn>
        <Panel
          title="What drives the model"
          description="Exact global SHAP importance over the holdout · top 12 features"
        >
          <ShapChart rows={shapSummary} />
        </Panel>
      </FadeIn>
    </div>
  );
}
