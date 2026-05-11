"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@/contexts/ThemeContext";
import { formatCurrency } from "@/lib/format";

export type FootballFieldColor =
  | "bull"
  | "accent"
  | "indigo-light"
  | "bear";

export interface FootballFieldMethod {
  label: string;
  value: number;
  color: FootballFieldColor;
}

interface FootballFieldProps {
  currentPrice: number | null;
  methods: FootballFieldMethod[];
}

interface ResolvedColors {
  bull: string;
  accent: string;
  "indigo-light": string;
  bear: string;
  textSecondary: string;
  textTertiary: string;
  borderDefault: string;
}

function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

export function FootballField({ currentPrice, methods }: FootballFieldProps) {
  const { theme } = useTheme();
  const [colors, setColors] = useState<ResolvedColors | null>(null);

  useEffect(() => {
    setColors({
      bull: readVar("--bull", "#16A34A"),
      accent: readVar("--accent", "#6366F1"),
      "indigo-light": "#818CF8",
      bear: readVar("--bear", "#DC2626"),
      textSecondary: readVar("--text-secondary", "#475569"),
      textTertiary: readVar("--text-tertiary", "#64748B"),
      borderDefault: readVar("--border-default", "#E5E7EB"),
    });
  }, [theme]);

  if (methods.length === 0) {
    return (
      <div className="ff-empty">
        No implied per-share values available for this ticker.
      </div>
    );
  }

  if (!colors) {
    // Initial paint before useEffect resolves CSS vars; keeps the layout stable.
    return <div className="ff-container" />;
  }

  const maxVal = Math.max(
    ...methods.map((m) => m.value),
    currentPrice ?? 0,
  );
  const domainMax = maxVal * 1.18;

  // Closure-based tooltip — keeps Recharts' built-in TooltipProps shape so we
  // don't fight the v3 readonly payload typing.
  const renderTooltip = (props: {
    active?: boolean;
    payload?: ReadonlyArray<{ payload?: FootballFieldMethod }>;
  }) => {
    if (!props.active || !props.payload || props.payload.length === 0) {
      return null;
    }
    const item = props.payload[0]?.payload;
    if (!item) return null;
    const hasCurrent = currentPrice != null && currentPrice > 0;
    const delta = hasCurrent ? (item.value - currentPrice) / currentPrice : null;
    const deltaColor =
      delta == null ? colors.textSecondary : delta >= 0 ? colors.bull : colors.bear;
    return (
      <div className="ff-tooltip">
        <div className="ff-tooltip-label">{item.label}</div>
        <div className="ff-tooltip-value">{formatCurrency(item.value)}</div>
        {delta != null ? (
          <div className="ff-tooltip-delta" style={{ color: deltaColor }}>
            {delta >= 0 ? "+" : ""}
            {(delta * 100).toFixed(1)}% vs market
          </div>
        ) : null}
      </div>
    );
  };

  const labelFormatter = (value: unknown): string => {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? formatCurrency(n) : "";
  };

  return (
    <div>
      <div className="ff-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
          layout="vertical"
          data={methods}
          margin={{ top: 30, right: 80, bottom: 10, left: 20 }}
        >
          <XAxis type="number" hide domain={[0, domainMax]} />
          <YAxis
            dataKey="label"
            type="category"
            width={100}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: colors.textSecondary }}
          />
          <Tooltip
            cursor={{ fill: "rgba(99, 102, 241, 0.06)" }}
            content={renderTooltip}
          />
          {currentPrice != null && currentPrice > 0 ? (
            <ReferenceLine
              x={currentPrice}
              stroke={colors.bear}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Current ${formatCurrency(currentPrice)}`,
                position: "top",
                fontSize: 11,
                fill: colors.bear,
              }}
            />
          ) : null}
          <Bar dataKey="value" barSize={28} radius={[0, 4, 4, 0]}>
            {methods.map((m, i) => (
              <Cell key={i} fill={colors[m.color]} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={labelFormatter}
              fontSize={11}
              fill={colors.textSecondary}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>

      <div className="ff-legend">
        {methods.map((m) => (
          <div key={m.label} className="ff-legend-item">
            <span
              className="ff-legend-dot"
              style={{ background: colors[m.color] }}
              aria-hidden="true"
            />
            {m.label}
          </div>
        ))}
        {currentPrice != null && currentPrice > 0 ? (
          <div className="ff-legend-item">
            <span
              className="ff-legend-dot ff-legend-dashed"
              style={{ borderColor: colors.bear }}
              aria-hidden="true"
            />
            Current price
          </div>
        ) : null}
      </div>
    </div>
  );
}

