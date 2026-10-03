"use client";

import { useId, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { RangeChart, type RangeRow } from "@/components/charts/RangeChart";
import { runDcf } from "@/lib/dcf-engine";
import { DEMO_COMPANY, demoInputs, type DemoAssumptions } from "@/lib/demo-company";
import { abbreviateNumber, formatCurrency, formatPercent, formatRate, toneOf } from "@/lib/format";

interface SliderSpec {
  key: keyof DemoAssumptions;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
}

const SLIDERS: SliderSpec[] = [
  { key: "y1Growth", label: "Revenue growth, year 1", hint: "Fades linearly to terminal growth by year 5", min: 0, max: 0.25, step: 0.0025 },
  { key: "ebitMargin", label: "EBIT margin", hint: "Operating profit as a share of revenue", min: 0.05, max: 0.4, step: 0.0025 },
  { key: "wacc", label: "Discount rate (WACC)", hint: "CAPM cost of equity blended with after-tax debt", min: 0.06, max: 0.14, step: 0.0005 },
  { key: "terminalGrowth", label: "Terminal growth", hint: "Long-run nominal growth after year 5", min: 0, max: 0.04, step: 0.0025 },
];

export function ValuationDemo() {
  const [a, setA] = useState<DemoAssumptions>({ ...DEMO_COMPANY.defaults });
  const baseId = useId();

  const result = useMemo(() => runDcf(demoInputs(a)), [a]);
  const range = useMemo(() => {
    const corners: number[] = [];
    for (const dw of [-0.01, 0.01]) {
      for (const dg of [-0.005, 0.005]) {
        const r = runDcf(demoInputs({ ...a, wacc: a.wacc + dw, terminalGrowth: a.terminalGrowth + dg }));
        if (r.ok) corners.push(r.perShare);
      }
    }
    return corners.length >= 2 ? { low: Math.min(...corners), high: Math.max(...corners) } : null;
  }, [a]);

  const price = DEMO_COMPANY.currentPrice;
  const isDefault = SLIDERS.every((s) => a[s.key] === DEMO_COMPANY.defaults[s.key]);

  const rows: RangeRow[] = [
    {
      label: "DCF",
      sublabel: "±1% WACC, ±0.5% g",
      base: result.ok ? result.perShare : null,
      low: range?.low ?? null,
      high: range?.high ?? null,
      emphasis: true,
    },
    ...DEMO_COMPANY.peerRanges.map((p) => ({ label: p.label, sublabel: "peer quartiles", base: p.base, low: p.low, high: p.high })),
  ];

  const upside = result.ok ? (result.perShare - price) / price : null;

  return (
    <div className="demo">
      <div className="demo-inputs panel">
        <div className="demo-company">
          <div>
            <span className="eyebrow">Illustrative company</span>
            <h3>
              {DEMO_COMPANY.name} <span className="mono demo-ticker">{DEMO_COMPANY.ticker}</span>
            </h3>
            <p>{DEMO_COMPANY.sector}</p>
          </div>
          <dl className="demo-facts">
            <div>
              <dt>Revenue (LTM)</dt>
              <dd className="num">{abbreviateNumber(DEMO_COMPANY.base.latestRevenue, "USD", 1)}</dd>
            </div>
            <div>
              <dt>3y revenue CAGR</dt>
              <dd className="num">{formatRate(DEMO_COMPANY.historicalCagr, 1)}</dd>
            </div>
            <div>
              <dt>Share price</dt>
              <dd className="num">{formatCurrency(price)}</dd>
            </div>
          </dl>
        </div>

        <div className="demo-sliders">
          {SLIDERS.map((s) => {
            const id = `${baseId}-${s.key}`;
            return (
              <div key={s.key} className="slider-field">
                <div className="slider-head">
                  <label htmlFor={id}>{s.label}</label>
                  <output htmlFor={id} className="num">
                    {formatRate(a[s.key], s.key === "wacc" ? 2 : 1)}
                  </output>
                </div>
                <input
                  id={id}
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={a[s.key]}
                  aria-describedby={`${id}-hint`}
                  aria-valuetext={formatRate(a[s.key], 2)}
                  onChange={(e) => setA((prev) => ({ ...prev, [s.key]: Number(e.target.value) }))}
                  style={{ ["--fill" as string]: `${((a[s.key] - s.min) / (s.max - s.min)) * 100}%` }}
                />
                <p id={`${id}-hint`} className="slider-hint">
                  {s.hint}
                </p>
              </div>
            );
          })}
          <button
            type="button"
            className="btn btn-ghost btn-sm demo-reset"
            onClick={() => setA({ ...DEMO_COMPANY.defaults })}
            disabled={isDefault}
          >
            <RotateCcw size={13} strokeWidth={1.8} aria-hidden="true" />
            Reset assumptions
          </button>
        </div>
      </div>

      <div className="demo-output panel" aria-live="polite">
        {result.ok ? (
          <>
            <div className="demo-headline">
              <div>
                <span className="eyebrow">Intrinsic value per share</span>
                <strong className="demo-value num">{formatCurrency(result.perShare)}</strong>
              </div>
              <div className="demo-delta">
                <span className={`num tone-${toneOf(upside)}`}>{formatPercent(upside)}</span>
                <span>vs {formatCurrency(price)} market</span>
              </div>
            </div>
            <dl className="demo-kpis">
              <div>
                <dt>Enterprise value</dt>
                <dd className="num">{abbreviateNumber(result.enterpriseValue, "USD", 1)}</dd>
              </div>
              <div>
                <dt>Equity value</dt>
                <dd className="num">{abbreviateNumber(result.equityValue, "USD", 1)}</dd>
              </div>
              <div>
                <dt>Terminal value share</dt>
                <dd className={`num${result.terminalShare > 0.85 ? " tone-warn" : ""}`}>
                  {formatRate(result.terminalShare, 0)}
                </dd>
              </div>
            </dl>
            <RangeChart
              rows={rows}
              marker={{ value: price, label: "Market" }}
              caption="Illustrative football field"
            />
            <div className="table-scroll demo-table">
              <table className="data-table">
                <caption className="sr-only">Projected free cash flow to the firm</caption>
                <thead>
                  <tr>
                    <th scope="col">USD</th>
                    {result.projections.map((p) => (
                      <th key={p.year} scope="col" className="num">Y{p.year}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Revenue</th>
                    {result.projections.map((p) => (
                      <td key={p.year} className="num">{abbreviateNumber(p.revenue, "USD", 1)}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">FCFF</th>
                    {result.projections.map((p) => (
                      <td key={p.year} className="num">{abbreviateNumber(p.fcff, "USD", 2)}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">PV of FCFF</th>
                    {result.projections.map((p) => (
                      <td key={p.year} className="num">{abbreviateNumber(p.pvFcff, "USD", 2)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="notice notice-warn" role="alert">
            <span aria-hidden="true">!</span>
            <span>{result.reason}</span>
          </div>
        )}
        <p className="demo-footnote">
          Illustrative company and local data — this demo makes no market-data request. Peer ranges are
          fixed for illustration; live reports compute them from real peers.
        </p>
      </div>
    </div>
  );
}
