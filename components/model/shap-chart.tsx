"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = "#8593a8";

type ShapRow = { feature: string; meanAbsContrib: number };

/**
 * Which features drive the model, globally — exact SHAP importance computed
 * offline over the holdout.
 *
 * This is the counterpart to the per-transaction explanation in the review
 * drawer: that one is a fast approximation for a single case, this one is the
 * exact, whole-dataset picture. Every feature but Amount is an anonymized PCA
 * component, so the labels are what the dataset provides — but the shape is real,
 * and V14 dominating is a known signature of this dataset.
 */
export function ShapChart({ rows }: { rows: ShapRow[] }) {
  const data = rows.slice(0, 12).map((row) => ({
    feature: row.feature === "Amount" ? "Amount" : row.feature,
    value: row.meanAbsContrib,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <XAxis
          type="number"
          stroke="#1e2530"
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="feature"
          stroke="#1e2530"
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => [Number(value).toFixed(3), "mean |SHAP|"]}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((row) => (
            <Cell key={row.feature} fill="var(--series)" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
