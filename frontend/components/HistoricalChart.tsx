"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@/contexts/ThemeContext";
import { abbreviateNumber, formatCurrency } from "@/lib/format";
import type { HistoricalFinancials } from "@/types/valuation";

interface HistoricalChartProps {
  data: HistoricalFinancials["historical"];
}

interface ResolvedColors {
  accent: string;
  bull: string;
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

export function HistoricalChart({ data }: HistoricalChartProps) {
  const { theme } = useTheme();
  const [colors, setColors] = useState<ResolvedColors | null>(null);

  useEffect(() => {
    setColors({
      accent: readVar("--accent", "#6366F1"),
      bull: readVar("--bull", "#16A34A"),
      textSecondary: readVar("--text-secondary", "#475569"),
      textTertiary: readVar("--text-tertiary", "#64748B"),
      borderDefault: readVar("--border-default", "#E5E7EB"),
    });
  }, [theme]);

  if (!data || data.length === 0) {
    return (
      <div className="historical-empty">
        Historical data unavailable for this ticker.
      </div>
    );
  }

  if (!colors) {
    return <div className="historical-chart-container" />;
  }

  const limitedHistory = data.length < 3;

  // Recharts v3's TooltipContentProps generics don't play nicely with hand-rolled
  // payload shapes — using a loose signature here is the pragmatic escape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTooltip = (props: any): ReactNode => {
    if (!props?.active || !props?.payload || props.payload.length === 0) {
      return null;
    }
    interface PayloadItem {
      dataKey?: string | number;
      name?: string | number;
      value?: unknown;
      color?: string;
    }
    const items = props.payload as PayloadItem[];
    const label = props.label;
    return (
      <div className="ff-tooltip">
        <div className="ff-tooltip-label">FY {String(label ?? "")}</div>
        {items.map((p, i) => {
          const numericValue = typeof p.value === "number" ? p.value : null;
          const key =
            typeof p.dataKey === "string" || typeof p.dataKey === "number"
              ? String(p.dataKey)
              : String(i);
          return (
            <div
              key={key}
              style={{
                color: p.color,
                marginTop: 4,
                fontSize: 12,
                fontFamily:
                  "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              {String(p.name ?? "")}:{" "}
              {numericValue != null ? formatCurrency(numericValue) : "—"}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      {limitedHistory ? (
        <div className="historical-note">Limited history available.</div>
      ) : null}
      <div className="historical-chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.accent} stopOpacity={0.3} />
                <stop
                  offset="100%"
                  stopColor={colors.accent}
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient id="ebitdaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.bull} stopOpacity={0.25} />
                <stop
                  offset="100%"
                  stopColor={colors.bull}
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient
                id="netIncomeGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={colors.textSecondary}
                  stopOpacity={0.2}
                />
                <stop
                  offset="100%"
                  stopColor={colors.textSecondary}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke={colors.borderDefault}
              strokeDasharray="3 3"
              opacity={0.4}
            />
            <XAxis
              dataKey="year"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: colors.textTertiary }}
            />
            <YAxis
              tickFormatter={(value) => abbreviateNumber(value as number)}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: colors.textTertiary }}
              width={62}
            />
            <Tooltip content={renderTooltip} />
            <Legend
              wrapperStyle={{
                fontSize: 11,
                color: colors.textTertiary,
                paddingTop: 6,
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={colors.accent}
              strokeWidth={1.5}
              fill="url(#revenueGradient)"
            />
            <Area
              type="monotone"
              dataKey="ebitda"
              name="EBITDA"
              stroke={colors.bull}
              strokeWidth={1.5}
              fill="url(#ebitdaGradient)"
            />
            <Area
              type="monotone"
              dataKey="net_income"
              name="Net Income"
              stroke={colors.textSecondary}
              strokeWidth={1.5}
              fill="url(#netIncomeGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
