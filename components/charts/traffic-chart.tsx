"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Stats } from "@/lib/stats";

const AXIS = "#8593a8";
const GRID = "#1e2530";

function hour(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric" });
}

/**
 * Volume over the last 24 hours, with confirmed fraud drawn on the same axis.
 *
 * Fraud is ~0.17% of traffic, so plotting it on its own y-axis would be a lie
 * that makes it look like half the business. It shares the axis and stays a thin
 * line near zero, which is the truth and is exactly why the model is needed.
 */
export function TrafficChart({ stats }: { stats?: Stats }) {
  const data = (stats?.traffic ?? []).map((row) => ({
    hour: hour(row.hour),
    Transactions: row.count,
    Fraud: row.frauds,
  }));

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
        Traffic
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Hourly volume, with confirmed fraud on the same scale
      </p>

      {data.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
          No traffic in the last 24 hours yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--series)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--series)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="hour"
              stroke={GRID}
              tick={{ fill: AXIS, fontSize: 11 }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              stroke={GRID}
              tick={{ fill: AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={44}
            />
            <Tooltip
              cursor={{ stroke: AXIS, strokeWidth: 1 }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--muted-foreground)" }}
            />
            <Legend
              iconType="plainline"
              wrapperStyle={{ fontSize: 11, color: AXIS, paddingTop: 4 }}
            />
            <Area
              type="monotone"
              dataKey="Transactions"
              stroke="var(--series)"
              strokeWidth={2}
              fill="url(#trafficFill)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            />
            <Line
              type="monotone"
              dataKey="Fraud"
              stroke="var(--blocked)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
