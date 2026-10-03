"use client";

import { useEffect, useRef, useState } from "react";
import type { HistoricalFinancials } from "@/types/valuation";
import { abbreviateNumber } from "@/lib/format";

type Row = HistoricalFinancials["historical"][number];

interface HistoricalChartProps {
  data: Row[];
  currency?: string | null;
}

const SERIES = [
  { key: "revenue", label: "Revenue", color: "var(--series-1)" },
  { key: "ebitda", label: "EBITDA", color: "var(--series-2)" },
  { key: "net_income", label: "Net income", color: "var(--series-3)" },
] as const;

const H = 280;
const M = { top: 16, right: 8, bottom: 28, left: 64 };

function niceMax(v: number): number {
  if (v <= 0) return 0;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

/** Grouped bars: one group per fiscal year. Missing values are drawn as gaps. */
export function HistoricalChart({ data, currency }: HistoricalChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (data.length === 0) {
    return <p className="range-empty">No historical statements available.</p>;
  }

  const values = data.flatMap((r) => SERIES.map((s) => r[s.key])).filter((v): v is number => v != null && Number.isFinite(v));
  const yMax = niceMax(Math.max(0, ...values)) || 1;
  const rawMin = Math.min(0, ...values);
  const yMin = rawMin < 0 ? -niceMax(-rawMin) : 0;
  const plotW = width - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const y = (v: number) => M.top + ((yMax - v) / (yMax - yMin)) * plotH;
  const groupW = plotW / data.length;
  const barW = Math.min(22, (groupW * 0.72) / SERIES.length - 2);
  const ticks = [yMin, yMin + (yMax - yMin) * 0.25, yMin + (yMax - yMin) * 0.5, yMin + (yMax - yMin) * 0.75, yMax];
  const missing = data.some((r) => SERIES.some((s) => r[s.key] == null));
  const fmt = (v: number | null) => (v == null ? "n/a" : abbreviateNumber(v, currency, 1));

  return (
    <div className="history">
      <div className="chart-legend">
        {SERIES.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </div>
      <div ref={wrapRef} className="history-plot">
        <svg width={width} height={H} role="img" aria-label="Annual revenue, EBITDA and net income by fiscal year; values are listed in the table below.">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--line)" />
              <text x={M.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="axis-label">
                {abbreviateNumber(t, currency, t === 0 ? 0 : 1)}
              </text>
            </g>
          ))}
          <line x1={M.left} x2={width - M.right} y1={y(0)} y2={y(0)} stroke="var(--ink-4)" />
          {data.map((r, gi) => {
            const gx = M.left + gi * groupW;
            const start = gx + (groupW - (barW + 2) * SERIES.length) / 2;
            return (
              <g key={r.year} onMouseEnter={() => setHover(gi)} onMouseLeave={() => setHover(null)}>
                <rect x={gx} y={M.top} width={groupW} height={plotH} fill={hover === gi ? "var(--surface-inset)" : "transparent"} />
                {SERIES.map((s, si) => {
                  const v = r[s.key];
                  const x = start + si * (barW + 2);
                  if (v == null) {
                    return (
                      <text key={s.key} x={x + barW / 2} y={y(0) - 6} textAnchor="middle" className="axis-label">
                        ·
                      </text>
                    );
                  }
                  const top = Math.min(y(v), y(0));
                  const h = Math.max(1, Math.abs(y(v) - y(0)));
                  return <rect key={s.key} x={x} y={top} width={barW} height={h} rx={v >= 0 ? 3 : 2} fill={s.color} />;
                })}
                <text x={gx + groupW / 2} y={H - 8} textAnchor="middle" className="axis-label">
                  FY{r.year}
                </text>
              </g>
            );
          })}
        </svg>
        {hover != null ? (
          <div
            className="chart-tooltip"
            style={{ left: Math.min(width - 180, Math.max(0, M.left + hover * groupW + groupW / 2 - 90)) }}
          >
            <strong>FY{data[hover].year}</strong>
            {SERIES.map((s) => (
              <span key={s.key}>
                <i style={{ background: s.color }} aria-hidden="true" />
                {s.label}
                <b className="num">{fmt(data[hover][s.key])}</b>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <details className="chart-table">
        <summary>View as table</summary>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{currency ?? "USD"}</th>
                {data.map((r) => <th key={r.year} scope="col" className="num">FY{r.year}</th>)}
              </tr>
            </thead>
            <tbody>
              {SERIES.map((s) => (
                <tr key={s.key}>
                  <th scope="row">{s.label}</th>
                  {data.map((r) => <td key={r.year} className="num">{fmt(r[s.key])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {missing ? <p className="table-footnote">Some line items were not reported by the provider and are shown as gaps, not zero.</p> : null}
      {data.length < 3 ? <p className="table-footnote">Limited history: fewer than three fiscal years available.</p> : null}
    </div>
  );
}
