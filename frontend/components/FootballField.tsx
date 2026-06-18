"use client";

import { useEffect, useRef, useState } from "react";
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
import { formatCurrency } from "@/lib/format";
import { useThemeColors, type ThemeColors } from "@/lib/useThemeColors";

export type FootballFieldColor =
  | "bull"
  | "accent"
  | "cyan"
  | "bear";

export interface FootballFieldMethod {
  label: string;
  base: number;
  low: number | null;
  high: number | null;
  color: FootballFieldColor;
}

interface FootballFieldProps {
  currentPrice: number | null;
  methods: FootballFieldMethod[];
}

// Augmented row fed to Recharts.
interface MethodRow extends FootballFieldMethod {
  _offset: number;
  _span: number;
  _endValue: number;
  _isPoint: boolean;
}

function isValidRange(m: FootballFieldMethod): boolean {
  return (
    m.low != null &&
    m.high != null &&
    Number.isFinite(m.low) &&
    Number.isFinite(m.high) &&
    m.high > m.low
  );
}

const CHART_HEIGHT = 280;
const CHART_MARGIN_TOP = 30;
const CHART_MARGIN_RIGHT = 80;
const CHART_MARGIN_BOTTOM = 10;
const CHART_MARGIN_LEFT = 20;
const Y_AXIS_WIDTH = 100;
const BAR_SIZE = 28;

export function FootballField({ currentPrice, methods }: FootballFieldProps) {
  const colors = useThemeColors();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const summaryLines = methods.map((m) => {
    const range = isValidRange(m)
      ? `${formatCurrency(m.low!)} to ${formatCurrency(m.high!)}`
      : formatCurrency(m.base);
    const vsMarket =
      currentPrice != null && currentPrice > 0 && m.base != null
        ? ` ${m.base >= currentPrice ? "above" : "below"} current price ${formatCurrency(currentPrice)}`
        : "";
    return `${m.label}: ${formatCurrency(m.base)} (${range})${vsMarket}`;
  });
  const ariaSummary = `Valuation football field. ${summaryLines.join(". ")}.`;

  useEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl || typeof ResizeObserver === "undefined") return;

    setContainerWidth(containerEl.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  }, []);

  if (methods.length === 0) {
    return (
      <div className="ff-empty">
        No implied per-share values available for this ticker.
      </div>
    );
  }

  const rows: MethodRow[] = methods.map((m) => {
    if (isValidRange(m)) {
      const low = m.low as number;
      const high = m.high as number;
      return {
        ...m,
        _offset: low,
        _span: high - low,
        _endValue: high,
        _isPoint: false,
      };
    }
    return {
      ...m,
      _offset: 0,
      _span: m.base,
      _endValue: m.base,
      _isPoint: true,
    };
  });

  const domainCandidates: number[] = [];
  for (const m of methods) {
    if (Number.isFinite(m.base)) domainCandidates.push(m.base);
    if (m.low != null && Number.isFinite(m.low)) domainCandidates.push(m.low);
    if (m.high != null && Number.isFinite(m.high)) domainCandidates.push(m.high);
  }
  if (currentPrice != null && currentPrice > 0) {
    domainCandidates.push(currentPrice);
  }
  const maxVal = domainCandidates.length > 0 ? Math.max(...domainCandidates) : 0;
  const domainMax = maxVal * 1.18;

  const c = colors as ThemeColors & { cyan: string };
  const resolvedCyan = c.cyan ?? "#06B6D4";
  const colorMap: Record<FootballFieldColor, string> = {
    bull: c.bull,
    accent: c.accent,
    cyan: resolvedCyan,
    bear: c.bear,
  };

  const renderTooltip = (props: {
    active?: boolean;
    payload?: ReadonlyArray<{ payload?: MethodRow }>;
  }) => {
    if (!props.active || !props.payload || props.payload.length === 0) {
      return null;
    }
    const item = props.payload
      .map((p) => p.payload)
      .find((p): p is MethodRow => !!p && typeof p.base === "number");
    if (!item) return null;
    const hasCurrent = currentPrice != null && currentPrice > 0;
    const delta = hasCurrent ? (item.base - currentPrice) / currentPrice : null;
    const deltaColor =
      delta == null ? c.textSecondary : delta >= 0 ? c.bull : c.bear;
    return (
      <div className="ff-tooltip">
        <div className="ff-tooltip-label">{item.label}</div>
        <div className="ff-tooltip-value">{formatCurrency(item.base)}</div>
        {!item._isPoint && item.low != null && item.high != null ? (
          <div className="ff-tooltip-range">
            Range {formatCurrency(item.low)} – {formatCurrency(item.high)}
          </div>
        ) : null}
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

  const markerRows = rows.filter((r) => !r._isPoint && Number.isFinite(r.base));

  const plotLeft = CHART_MARGIN_LEFT + Y_AXIS_WIDTH;
  const plotWidth =
    containerWidth > 0
      ? Math.max(0, containerWidth - plotLeft - CHART_MARGIN_RIGHT)
      : 0;
  const plotTop = CHART_MARGIN_TOP;
  const plotHeight = CHART_HEIGHT - CHART_MARGIN_TOP - CHART_MARGIN_BOTTOM;
  const rowH = rows.length > 0 ? plotHeight / rows.length : 0;
  const overlayReady = containerWidth > 0 && domainMax > 0 && rowH > 0;

  return (
    <div>
      <div
        ref={containerRef}
        className="ff-container"
        style={{ position: "relative" }}
        role="img"
        aria-describedby="ff-summary"
      >
        <span id="ff-summary" className="sr-only">
          {ariaSummary}
        </span>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart
            layout="vertical"
            data={rows}
            margin={{
              top: CHART_MARGIN_TOP,
              right: CHART_MARGIN_RIGHT,
              bottom: CHART_MARGIN_BOTTOM,
              left: CHART_MARGIN_LEFT,
            }}
          >
            <XAxis type="number" hide domain={[0, domainMax]} />
            <YAxis
              dataKey="label"
              type="category"
              width={100}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: c.textSecondary }}
            />
            <Tooltip
              cursor={{ fill: "rgba(99, 102, 241, 0.06)" }}
              content={renderTooltip}
            />
            {currentPrice != null && currentPrice > 0 ? (
              <ReferenceLine
                x={currentPrice}
                stroke={c.bear}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Current ${formatCurrency(currentPrice)}`,
                  position: "top",
                  fontSize: 11,
                  fill: c.bear,
                }}
              />
            ) : null}
            <Bar
              dataKey="_offset"
              stackId="ff"
              fill="transparent"
              isAnimationActive={false}
            />
            <Bar
              dataKey="_span"
              stackId="ff"
              barSize={BAR_SIZE}
              radius={[4, 4, 4, 4]}
              isAnimationActive={false}
            >
              {rows.map((r, i) => (
                <Cell key={i} fill={colorMap[r.color]} />
              ))}
              <LabelList
                dataKey="base"
                position="right"
                formatter={labelFormatter}
                fontSize={11}
                fill={c.textSecondary}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {overlayReady ? (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
            }}
          >
            {markerRows.map((r) => {
              const rowIndex = rows.indexOf(r);
              if (rowIndex < 0) return null;
              const tickX = plotLeft + (r.base / domainMax) * plotWidth;
              const centerY = plotTop + (rowIndex + 0.5) * rowH;
              return (
                <div
                  key={`bm-${r.label}`}
                  style={{
                    position: "absolute",
                    left: tickX - 1.5,
                    top: centerY - BAR_SIZE / 2,
                    width: 3,
                    height: BAR_SIZE,
                    background: "#ffffff",
                    border: "0.6px solid rgba(15, 23, 42, 0.55)",
                    borderRadius: 1,
                    boxSizing: "border-box",
                  }}
                />
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="ff-legend">
        {methods.map((m) => (
          <div key={m.label} className="ff-legend-item">
            <span
              className="ff-legend-dot"
              style={{ background: colorMap[m.color] }}
              aria-hidden="true"
            />
            {m.label}
          </div>
        ))}
        {currentPrice != null && currentPrice > 0 ? (
          <div className="ff-legend-item">
            <span
              className="ff-legend-dot ff-legend-dashed"
              style={{ borderColor: c.bear }}
              aria-hidden="true"
            />
            Current price
          </div>
        ) : null}
      </div>
    </div>
  );
}
