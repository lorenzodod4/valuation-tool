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
import { useTheme } from "@/contexts/ThemeContext";
import { formatCurrency } from "@/lib/format";

export type FootballFieldColor =
  | "bull"
  | "accent"
  | "cyan"
  | "bear";

export interface FootballFieldMethod {
  label: string;
  base: number; // single-point marker (was `value`)
  low: number | null; // range start; null → degraded single-point fallback
  high: number | null; // range end; null → degraded single-point fallback
  color: FootballFieldColor;
}

interface FootballFieldProps {
  currentPrice: number | null;
  methods: FootballFieldMethod[];
}

interface ResolvedColors {
  bull: string;
  accent: string;
  // Cyan keeps EV/EBITDA visually distinct from P/E (which uses `accent`,
  // a similar indigo). Hardcoded — no CSS-var dependency needed because the
  // color is theme-agnostic enough for both light and dark.
  cyan: string;
  bear: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  borderDefault: string;
}

// Augmented row fed to Recharts. The underscore-prefixed fields are visualization
// scaffolding (stacked-bar offset/span, label target, fallback flag) — they
// don't appear in the public type contract.
interface MethodRow extends FootballFieldMethod {
  _offset: number;
  _span: number;
  _endValue: number;
  _isPoint: boolean;
}

function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
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

// Chart layout constants — kept as module-level so they're referenced by
// both the BarChart `margin` prop and the overlay's positioning math. Keeping
// them in sync is what makes the absolute-positioned tick overlay land on
// the exact same x as the bars without consulting Recharts internals.
const CHART_HEIGHT = 280;
const CHART_MARGIN_TOP = 30;
const CHART_MARGIN_RIGHT = 80;
const CHART_MARGIN_BOTTOM = 10;
const CHART_MARGIN_LEFT = 20;
const Y_AXIS_WIDTH = 100;
const BAR_SIZE = 28;

export function FootballField({ currentPrice, methods }: FootballFieldProps) {
  const { theme } = useTheme();
  const [colors, setColors] = useState<ResolvedColors | null>(null);

  // Tracks the live pixel width of the chart container. Used by the
  // base-marker overlay to map data values to absolute pixel positions
  // — see comments in the overlay block below for the full math.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    setColors({
      bull: readVar("--bull", "#16A34A"),
      accent: readVar("--accent", "#6366F1"),
      cyan: "#06B6D4",
      bear: readVar("--bear", "#DC2626"),
      textPrimary: readVar("--text-primary", "#0F172A"),
      textSecondary: readVar("--text-secondary", "#475569"),
      textTertiary: readVar("--text-tertiary", "#64748B"),
      borderDefault: readVar("--border-default", "#E5E7EB"),
    });
  }, [theme]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Initial sync read so first paint has a width.
    setContainerWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // Stacked-bar trick: render a transparent "offset" bar followed by a visible
  // "span" bar so the colored segment runs from `low` to `high` instead of
  // from 0 to `base`. When low/high is missing, fall back to a degraded
  // single-point bar that runs from 0 to base (and we skip the base marker
  // since the bar's right edge already represents the value).
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

  // Domain max must account for the highest `high` across methods (not just
  // bases) so range bars don't get clipped on the right.
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

  // Tooltip: with stacked bars, Recharts passes one payload entry per Bar.
  // Both entries share the same `payload` row object, so we just read it from
  // the first entry that has the `base` field populated.
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
      delta == null ? colors.textSecondary : delta >= 0 ? colors.bull : colors.bear;
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

  // Rows we'll actually draw a tick for (skip degraded single-point rows).
  // Computed here so the overlay can reuse the same filtered list.
  const markerRows = rows.filter((r) => !r._isPoint && Number.isFinite(r.base));

  // Plotting-area math, mirrored from the chart's own constants:
  //   plotLeft  = CHART_MARGIN_LEFT + Y_AXIS_WIDTH
  //   plotRight = containerWidth − CHART_MARGIN_RIGHT
  //   plotWidth = plotRight − plotLeft
  // Each value v maps to:   plotLeft + (v / domainMax) × plotWidth
  // Each row i sits at y center:
  //   plotTop    = CHART_MARGIN_TOP
  //   plotHeight = CHART_HEIGHT − CHART_MARGIN_TOP − CHART_MARGIN_BOTTOM
  //   rowH       = plotHeight / rows.length        (Recharts splits the plot
  //                                                 area into equal bands;
  //                                                 first row is at the top)
  //   centerY    = plotTop + (i + 0.5) × rowH
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
      >
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
            {/* Invisible spacer that pushes the visible segment to start at `low`. */}
            <Bar
              dataKey="_offset"
              stackId="ff"
              fill="transparent"
              isAnimationActive={false}
            />
            {/* Visible range segment, colored per method. */}
            <Bar
              dataKey="_span"
              stackId="ff"
              barSize={BAR_SIZE}
              radius={[4, 4, 4, 4]}
              isAnimationActive={false}
            >
              {rows.map((r, i) => (
                <Cell key={i} fill={colors[r.color]} />
              ))}
              <LabelList
                dataKey="base"
                position="right"
                formatter={labelFormatter}
                fontSize={11}
                fill={colors.textSecondary}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Base-marker overlay. Positioned in absolute pixel space using the
            chart's own layout constants (mirrored above). Both Recharts
            integration approaches we tried (Customized props, axis-scale
            hooks) returned undefined in this Recharts version, so we
            bypass the library and do the math ourselves. */}
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
