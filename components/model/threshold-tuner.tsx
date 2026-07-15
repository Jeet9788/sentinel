"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { BandMeter } from "@/components/band-meter";
import { ConfusionMatrix } from "@/components/model/confusion-matrix";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { fmtPercent } from "@/lib/format";
import { previewThresholds, type ThresholdRow } from "@/lib/threshold-preview";

function nearest(table: ThresholdRow[], threshold: number): ThresholdRow {
  return table.reduce((best, row) =>
    Math.abs(row.threshold - threshold) < Math.abs(best.threshold - threshold) ? row : best,
  );
}

/**
 * The tuner turns the model's probability into policy.
 *
 * The sliders do not change the model — they change the two cutoffs that decide
 * what happens to a score. Moving them is a business decision (how much fraud
 * loss to trade for how much customer friction), so the projected outcome is
 * shown live from the holdout table before anything is saved, and the confusion
 * matrix below reflects the block threshold as it moves.
 */
export function ThresholdTuner({
  table,
  initialLow,
  initialHigh,
}: {
  table: ThresholdRow[];
  initialLow: number;
  initialHigh: number;
}) {
  const [tLow, setTLow] = useState(initialLow);
  const [tHigh, setTHigh] = useState(initialHigh);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<{ tLow: number; tHigh: number }>({
    tLow: initialLow,
    tHigh: initialHigh,
  });

  const preview = useMemo(() => previewThresholds(table, tLow, tHigh), [table, tLow, tHigh]);
  const blockRow = useMemo(() => nearest(table, tHigh), [table, tHigh]);

  const dirty = tLow !== savedAt.tLow || tHigh !== savedAt.tHigh;

  // The review band must stay non-empty, or the human-in-the-loop disappears.
  const first = (value: number | readonly number[]) => (Array.isArray(value) ? value[0] : (value as number));
  const setLow = (value: number | readonly number[]) => setTLow(Math.min(first(value), tHigh - 0.005));
  const setHigh = (value: number | readonly number[]) => setTHigh(Math.max(first(value), tLow + 0.005));

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tLow, tHigh }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setSavedAt({ tLow, tHigh });
      toast.success("Thresholds updated", {
        description: "New transactions are now judged by this policy.",
      });
    } catch {
      toast.error("Could not save thresholds", { description: "Try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <BandMeter score={null} tLow={tLow} tHigh={tHigh} />

      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <label htmlFor="t-low" className="text-muted-foreground">
              Approve below
            </label>
            <span className="tabular" style={{ color: "var(--review)" }}>
              {tLow.toFixed(3)}
            </span>
          </div>
          <Slider
            id="t-low"
            min={0}
            max={1}
            step={0.005}
            value={[tLow]}
            onValueChange={setLow}
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <label htmlFor="t-high" className="text-muted-foreground">
              Block at or above
            </label>
            <span className="tabular" style={{ color: "var(--blocked)" }}>
              {tHigh.toFixed(3)}
            </span>
          </div>
          <Slider
            id="t-high"
            min={0}
            max={1}
            step={0.005}
            value={[tHigh]}
            onValueChange={setHigh}
          />
        </div>
      </div>

      <div className="rounded-md border border-border bg-background p-3 text-sm">
        <p className="leading-relaxed">
          At these settings, of the holdout traffic:{" "}
          <span style={{ color: "var(--approved)" }}>{fmtPercent(preview.pctApproved)} auto-approved</span>
          {" · "}
          <span style={{ color: "var(--review)" }}>{fmtPercent(preview.pctReview)} to review</span>
          {" · "}
          <span style={{ color: "var(--blocked)" }}>{fmtPercent(preview.pctBlocked)} blocked</span>.
        </p>
        <p className="mt-1 text-muted-foreground">
          Est. block precision {fmtPercent(preview.estPrecision)} · fraud caught{" "}
          {fmtPercent(preview.estRecall)}
        </p>
      </div>

      <ConfusionMatrix row={blockRow} />

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save thresholds"}
        </Button>
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
      </div>
    </div>
  );
}
