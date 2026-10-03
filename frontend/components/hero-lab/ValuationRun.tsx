"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { fadeSchedule, runDcf } from "@/lib/dcf-engine";
import { formatCurrency, formatPercent, formatRate, toneOf } from "@/lib/format";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * Concept C — "Run". The entrance performs a valuation: history, projection,
 * discounting, terminal value, then value per share against the market.
 * Interactive: switch company, drag the discount rate.
 */

interface RunCompany {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  historyFcf: number[]; // oldest → latest, USD bn
  revenue: number; // USD bn, latest
  y1: number;
  margin: number;
  wacc: number;
  tg: number;
  netDebt: number; // USD bn
  shares: number; // bn
}

const COMPANIES: RunCompany[] = [
  { ticker: "MRDN", name: "Meridian Instruments", sector: "Scientific instruments", price: 118, historyFcf: [1.18, 1.31, 1.42, 1.6, 1.74], revenue: 9.8, y1: 0.11, margin: 0.22, wacc: 0.086, tg: 0.025, netDebt: 1.1, shares: 0.34 },
  { ticker: "VNTR", name: "Vantor Semiconductor", sector: "Semiconductors", price: 64, historyFcf: [0.42, 0.61, 0.58, 0.9, 1.22], revenue: 6.1, y1: 0.24, margin: 0.29, wacc: 0.104, tg: 0.03, netDebt: -0.8, shares: 0.42 },
  { ticker: "HLCN", name: "Halcyon Foods", sector: "Packaged foods", price: 41, historyFcf: [1.02, 0.98, 1.05, 1.07, 1.1], revenue: 12.4, y1: 0.035, margin: 0.14, wacc: 0.072, tg: 0.02, netDebt: 4.6, shares: 0.52 },
];

const STAGES = 7; // 0 ticker · 1 history · 2 projection · 3 discount · 4 terminal · 5 bridge · 6 value
const STAGE_MS = 1050;
const HOLD_MS = 3200;

function compute(c: RunCompany, wacc: number) {
  return runDcf({
    latestRevenue: c.revenue * 1e9,
    growthRates: fadeSchedule(c.y1, c.tg),
    ebitMargin: c.margin,
    taxRate: 0.21,
    daPct: 0.04,
    capexPct: 0.045,
    wcPct: 0.01,
    wacc,
    terminalGrowth: c.tg,
    totalDebt: Math.max(c.netDebt, 0) * 1e9,
    cash: Math.max(-c.netDebt, 0) * 1e9,
    sharesOutstanding: c.shares * 1e9,
  });
}

export function ValuationRun() {
  const sliderId = useId();
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState(0);
  const [waccOverride, setWaccOverride] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const company = COMPANIES[index];
  const wacc = waccOverride ?? company.wacc;
  const result = useMemo(() => compute(company, wacc), [company, wacc]);
  const shown = reduce ? STAGES - 1 : stage;
  const paused = waccOverride !== null;

  useEffect(() => {
    if (reduce || paused) return;
    const id = window.setTimeout(
      () => {
        if (stage < STAGES - 1) setStage(stage + 1);
        else {
          setIndex((i) => (i + 1) % COMPANIES.length);
          setStage(0);
        }
      },
      stage < STAGES - 1 ? STAGE_MS : HOLD_MS,
    );
    return () => window.clearTimeout(id);
  }, [stage, reduce, paused]);

  if (!result.ok) return null;

  // Geometry (SVG units)
  const VBW = 640;
  const VBH = 300;
  const BASE = 250;
  const projFcf = result.projections.map((p) => p.fcff / 1e9);
  const pv = result.projections.map((p) => p.pvFcff / 1e9);
  const scaleMax = Math.max(...company.historyFcf, ...projFcf) * 1.15;
  // Rounded: server (Node) and browser floats can differ in the last digit.
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const h = (v: number) => r2((Math.max(v, 0) / scaleMax) * 190);
  const barW = 26;
  const histX = (i: number) => 24 + i * 40;
  const projX = (i: number) => 252 + i * 40;
  const tvX = 492;
  const tvNominal = result.terminalValue / 1e9;
  const tvPv = result.pvTerminalValue / 1e9;
  // Terminal value is drawn with an axis break: compressed, and labelled as such.
  const tvScale = 190 / (tvNominal * 1.05);
  const tvH = r2(tvNominal * tvScale);
  const tvPvH = r2(tvPv * tvScale);
  const upside = (result.perShare - company.price) / company.price;

  const select = (i: number) => {
    setIndex(i);
    setStage(reduce ? STAGES - 1 : 0);
    setWaccOverride(null);
  };

  return (
    <div className="run panel" data-stage={shown}>
      <div className="run-head">
        <div className="run-chips" role="tablist" aria-label="Illustrative companies">
          {COMPANIES.map((c, i) => (
            <button
              key={c.ticker}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`run-chip${i === index ? " is-active" : ""}`}
              onClick={() => select(i)}
            >
              {c.ticker}
            </button>
          ))}
        </div>
        <span className="run-status mono">
          {paused ? "manual" : ["fetching", "history", "projecting", "discounting", "terminal value", "bridge", "done"][shown]}
        </span>
      </div>

      <div className="run-title">
        <strong key={company.ticker} className="run-name">{company.name}</strong>
        <span>{company.sector} · illustrative</span>
      </div>

      <svg className="run-chart" viewBox={`0 0 ${VBW} ${VBH}`} role="img" aria-label={`${company.name}: five years of free cash flow history, five projected years discounted at ${formatRate(wacc)}, and a terminal value.`}>
        <line x1="12" x2={VBW - 12} y1={BASE} y2={BASE} className="run-axis" />
        <text x={histX(0)} y={BASE + 24} className="run-label">History · FCF</text>
        <text x={projX(0)} y={BASE + 24} className="run-label">Projection</text>
        <text x={tvX} y={BASE + 24} className="run-label">Terminal</text>

        {company.historyFcf.map((v, i) => (
          <rect
            key={`h${i}`}
            x={histX(i)}
            width={barW}
            y={BASE - h(v)}
            height={h(v)}
            rx="3"
            className="run-bar run-bar-hist"
            style={{ ["--d" as string]: `${i * 70}ms` }}
          />
        ))}

        {projFcf.map((v, i) => (
          <g key={`p${i}`} style={{ ["--d" as string]: `${i * 70}ms` }}>
            <rect x={projX(i)} width={barW} y={BASE - h(v)} height={h(v)} rx="3" className="run-bar run-bar-nominal" />
            <rect x={projX(i)} width={barW} y={BASE - h(pv[i])} height={h(pv[i])} rx="3" className="run-bar run-bar-pv" />
            <text x={projX(i) + barW / 2} y={BASE - h(v) - 8} className="run-df mono" textAnchor="middle">
              ×{(1 / (1 + wacc) ** (i + 1)).toFixed(2)}
            </text>
          </g>
        ))}

        <g className="run-tv">
          <rect x={tvX} width={barW * 2} y={BASE - tvH} height={tvH} rx="3" className="run-bar run-bar-nominal" />
          <rect x={tvX} width={barW * 2} y={BASE - tvPvH} height={tvPvH} rx="3" className="run-bar run-bar-pv run-bar-tv" />
          <path d={`M${tvX - 6} ${BASE - 70} l12 -6 M${tvX - 6} ${BASE - 62} l12 -6`} className="run-break" />
          <text x={tvX + barW} y={BASE - tvH - 8} className="run-df mono" textAnchor="middle">
            not to scale
          </text>
        </g>
      </svg>

      <div className="run-bridge mono" aria-hidden={shown < 5}>
        <span>Σ PV {formatCurrency(pv.reduce((a, b) => a + b, 0), 1)}B</span>
        <span>+ TV {formatCurrency(tvPv, 1)}B</span>
        <span>− net debt {formatCurrency(company.netDebt, 1)}B</span>
        <span>÷ {(company.shares * 1000).toFixed(0)}M shares</span>
      </div>

      <div className="run-result">
        <div>
          <span className="eyebrow">Value per share</span>
          <strong className="run-value figure">{formatCurrency(result.perShare)}</strong>
        </div>
        <div className="run-delta">
          <span className={`figure tone-${toneOf(upside)}`}>{formatPercent(upside)}</span>
          <span>vs {formatCurrency(company.price)} market</span>
        </div>
      </div>

      <div className="run-control">
        <label htmlFor={sliderId}>
          Discount rate <output className="num">{formatRate(wacc)}</output>
        </label>
        <input
          id={sliderId}
          type="range"
          min={0.05}
          max={0.15}
          step={0.0025}
          value={wacc}
          onChange={(e) => {
            setWaccOverride(Number(e.target.value));
            setStage(STAGES - 1);
          }}
          style={{ ["--fill" as string]: `${((wacc - 0.05) / 0.1) * 100}%` }}
        />
        {paused ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => select(index)}>
            Replay
          </button>
        ) : null}
      </div>
    </div>
  );
}
