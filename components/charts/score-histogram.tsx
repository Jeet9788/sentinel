"use client";

import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Decision } from "@/lib/decision";
import { DECISION_COLOR, DECISION_LABEL } from "@/lib/format";
import type { Stats } from "@/lib/stats";

const AXIS = "#8593a8";
const GRID = "#1e2530";

/**
 * A threshold can fall *inside* a bucket — with tHigh at 0.99, the entire block
 * band is narrower than one 0.05-wide bar. So a bar is colored by the decision
 * most of its transactions actually received, not by where its left edge sits.
 * Inferring the color from the edge would paint a bar amber while the
 * transactions inside it were being blocked.
 */
function dominantDecision(row: Stats["histogram"][number]): Decision {
  const { approved, review, blocked } = row;
  if (blocked >= review && blocked >= approved) return "blocked";
  if (review >= approved) return "review";
  return "approved";
}

/**
 * Where the model puts its scores — and what the policy does with them.
 *
 * Each bar is colored by the decision its bucket receives, so the thresholds are
 * not lines on a chart but the boundary between three differently-colored
 * regions. Two things are worth seeing here: the distribution is bimodal (a
 * working fraud model is confident, not hedging around 0.5), and almost all mass
 * sits in the first bucket — which is why the count axis is logarithmic. On a
 * linear axis, every bar except "approve" would be invisible.
 */
export function ScoreHistogram({
  stats,
  tLow,
  tHigh,
}: {
  stats?: Stats;
  tLow: number;
  tHigh: number;
}) {
  const data = (stats?.histogram ?? []).map((row) => ({
    bucket: row.bucket,
    label: row.bucket.toFixed(2),
    // Log scales cannot draw zero; an absent bar reads as "none", which is true.
    count: row.count > 0 ? row.count : null,
    decision: dominantDecision(row),
    approved: row.approved,
    review: row.review,
    blocked: row.blocked,
  }));

  const hasData = data.some((row) => row.count !== null);

  return (
    <section className="panel p-4">
      <h2 className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
        Score distribution
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Bars colored by the decision each score receives · count on a log scale
      </p>

      {!hasData ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
          No scored transactions in the last 24 hours yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="label"
              stroke={GRID}
              tick={{ fill: AXIS, fontSize: 11 }}
              tickLine={false}
              interval={3}
            />
            <YAxis
              scale="log"
              domain={[1, "dataMax"]}
              allowDataOverflow
              stroke={GRID}
              tick={{ fill: AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(label) => `Score ${label}–${(Number(label) + 0.05).toFixed(2)}`}
              formatter={(value, _name, item) => {
                const row = item?.payload as
                  | { approved: number; review: number; blocked: number }
                  | undefined;
                const split = (["approved", "review", "blocked"] as const)
                  .filter((key) => (row?.[key] ?? 0) > 0)
                  .map((key) => `${row?.[key]} ${DECISION_LABEL[key].toLowerCase()}`)
                  .join(" · ");
                return [`${value} transactions`, split];
              }}
            />
            <ReferenceLine
              x={data.find((row) => row.bucket >= tLow)?.label}
              stroke="var(--review)"
              strokeDasharray="3 3"
              label={{ value: "review", position: "top", fill: AXIS, fontSize: 10 }}
            />
            <ReferenceLine
              x={data.find((row) => row.bucket >= tHigh)?.label}
              stroke="var(--blocked)"
              strokeDasharray="3 3"
              label={{ value: "block", position: "top", fill: AXIS, fontSize: 10 }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
              {data.map((row) => (
                <Cell key={row.label} fill={DECISION_COLOR[row.decision]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
