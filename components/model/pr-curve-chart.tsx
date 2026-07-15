"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = "#8593a8";
const GRID = "#1e2530";

type CurvePoint = { threshold: number; precision: number; recall: number; flaggedRate: number };

/**
 * The precision–recall curve — the honest scorecard for a 0.17%-positive problem.
 *
 * At this base rate a ROC curve looks near-perfect for almost any model, because
 * the enormous true-negative mass drowns out the errors that matter. PR asks the
 * only questions a fraud team cares about: of what we flag, how much is real
 * (precision), and of all the fraud, how much do we catch (recall). The two dots
 * mark where the current review and block thresholds sit on that trade-off.
 */
export function PrCurveChart({
  curve,
  tLow,
  tHigh,
}: {
  curve: CurvePoint[];
  tLow: number;
  tHigh: number;
}) {
  const data = curve.map((point) => ({ recall: point.recall, precision: point.precision, threshold: point.threshold }));

  const at = (threshold: number) =>
    data.reduce((best, point) =>
      Math.abs(point.threshold - threshold) < Math.abs(best.threshold - threshold) ? point : best,
    );
  const lowPoint = at(tLow);
  const highPoint = at(tHigh);

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis
            type="number"
            dataKey="recall"
            domain={[0, 1]}
            stroke={GRID}
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            tickFormatter={(value) => value.toFixed(1)}
            label={{ value: "Recall", position: "insideBottom", offset: -2, fill: AXIS, fontSize: 11 }}
          />
          <YAxis
            type="number"
            domain={[0, 1]}
            stroke={GRID}
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => value.toFixed(1)}
            width={48}
            label={{ value: "Precision", angle: -90, position: "insideLeft", offset: 18, fill: AXIS, fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value, name) => [Number(value).toFixed(3), name]}
            labelFormatter={() => ""}
          />
          <Line
            type="monotone"
            dataKey="precision"
            stroke="var(--series)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <ReferenceDot
            x={lowPoint.recall}
            y={lowPoint.precision}
            r={5}
            fill="var(--review)"
            stroke="var(--card)"
            strokeWidth={2}
          />
          <ReferenceDot
            x={highPoint.recall}
            y={highPoint.precision}
            r={5}
            fill="var(--blocked)"
            stroke="var(--card)"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--review)" }} />
          review threshold
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--blocked)" }} />
          block threshold
        </span>
      </div>
    </div>
  );
}
