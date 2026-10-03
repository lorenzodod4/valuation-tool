"use client";

import { useId, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { DCFResult } from "@/types/valuation";
import { fadeSchedule, runDcf } from "@/lib/dcf-engine";
import { baseInputs, type Key, type Levers } from "@/lib/dcf-scenario";
import { formatCurrency, formatPercent, formatRate, toneOf } from "@/lib/format";

/**
 * What-if on the report's own DCF. Runs the client mirror of the server engine
 * (parity-tested) on the assumptions the server returned — no API request.
 * The report, range chart and PDF keep the server's base case.
 */

const r4 = (n: number) => Math.round(n * 10000) / 10000;

interface DCFScenarioProps {
  dcf: DCFResult;
  currency?: string | null;
}

export function DCFScenario({ dcf, currency }: DCFScenarioProps) {
  const uid = useId();
  const base = useMemo(() => baseInputs(dcf), [dcf]);
  const [levers, setLevers] = useState<Levers | null>(base?.levers ?? null);

  if (!base || !levers || dcf.per_share_value == null) return null;
  const b = base.levers;

  const sliders: Array<{ key: Key; label: string; min: number; max: number; step: number; hint: string }> = [
    { key: "wacc", label: "Discount rate (WACC)", min: Math.max(0.03, r4(b.wacc - 0.04)), max: r4(b.wacc + 0.04), step: 0.0005, hint: `Base ${formatRate(b.wacc)}` },
    { key: "tg", label: "Terminal growth", min: 0, max: 0.045, step: 0.0005, hint: `Base ${formatRate(b.tg)} · must stay below WACC` },
    { key: "y1", label: "Revenue growth, year 1", min: Math.min(-0.1, b.y1), max: Math.max(0.35, b.y1), step: 0.005, hint: `Base ${formatRate(b.y1, 1)} · fades to terminal growth by Y5` },
    { key: "margin", label: "EBIT margin", min: Math.max(-0.2, r4(b.margin - 0.15)), max: Math.min(0.7, r4(b.margin + 0.15)), step: 0.0025, hint: `Base ${formatRate(b.margin, 1)}` },
  ];

  const touchedGrowth = levers.y1 !== b.y1 || levers.tg !== b.tg;
  const result = runDcf({
    ...base.inputs,
    wacc: levers.wacc,
    terminalGrowth: levers.tg,
    ebitMargin: levers.margin,
    // Untouched: the server's exact schedule. Touched: the same fade rule it uses.
    growthRates: touchedGrowth ? fadeSchedule(levers.y1, levers.tg) : base.inputs.growthRates,
  });
  const isBase = (Object.keys(b) as Key[]).every((k) => levers[k] === b[k]);
  const baseValue = dcf.per_share_value;
  const price = dcf.current_price;
  const scenario = result.ok ? result.perShare : null;
  const vsBase = scenario != null && baseValue > 0 ? scenario / baseValue - 1 : null;
  const vsPrice = scenario != null && scenario > 0 && price ? scenario / price - 1 : null;

  // Value line: base, scenario and market on one scale.
  const pts = [baseValue, scenario, price].filter((v): v is number => v != null && Number.isFinite(v));
  const lo = Math.min(0, ...pts);
  const hi = Math.max(...pts) * 1.12 || 1;
  const pos = (v: number) => `${(((v - lo) / (hi - lo)) * 100).toFixed(2)}%`;

  return (
    <section className="scenario panel" aria-labelledby={`${uid}-title`}>
      <header className="scenario-head">
        <div>
          <h3 id={`${uid}-title`} className="subhead">What if?</h3>
          <p className="scenario-sub">
            Move an assumption to see how the value per share responds. Computed in your browser with the same
            engine as the report — no new data request, and the report itself keeps the base case.
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLevers(b)} disabled={isBase}>
          <RotateCcw size={13} strokeWidth={1.8} aria-hidden="true" />
          Back to base case
        </button>
      </header>

      <div className="scenario-grid">
        <div className="scenario-sliders">
          {sliders.map((s) => {
            const id = `${uid}-${s.key}`;
            const v = levers[s.key];
            const pct = (x: number) => `${(((x - s.min) / (s.max - s.min)) * 100).toFixed(2)}%`;
            return (
              <div key={s.key} className="slider-field">
                <div className="slider-head">
                  <label htmlFor={id}>{s.label}</label>
                  <output htmlFor={id} className={`num${v !== b[s.key] ? " is-changed" : ""}`}>
                    {formatRate(v, s.key === "wacc" || s.key === "tg" ? 2 : 1)}
                  </output>
                </div>
                <div className="scenario-track" style={{ ["--base-f" as string]: ((b[s.key] - s.min) / (s.max - s.min)).toFixed(4) }}>
                  <input
                    id={id}
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={v}
                    aria-describedby={`${id}-hint`}
                    aria-valuetext={formatRate(v, 2)}
                    onChange={(e) => setLevers((prev) => (prev ? { ...prev, [s.key]: r4(Number(e.target.value)) } : prev))}
                    style={{ ["--fill" as string]: pct(v) }}
                  />
                </div>
                <p id={`${id}-hint`} className="slider-hint">{s.hint}</p>
              </div>
            );
          })}
        </div>

        <div className="scenario-out" aria-live="polite">
          <div className="scenario-figures">
            <div>
              <span className="eyebrow">Scenario value / share</span>
              <strong className={`scenario-value figure${scenario != null && scenario <= 0 ? " tone-neg" : ""}`}>
                {result.ok ? formatCurrency(scenario, 2, currency) : "—"}
              </strong>
            </div>
            <dl className="scenario-deltas">
              <div>
                <dt>vs base case</dt>
                <dd className={`figure tone-${toneOf(vsBase)}`}>{formatPercent(vsBase)}</dd>
              </div>
              <div>
                <dt>vs market</dt>
                <dd className={`figure tone-${toneOf(vsPrice)}`}>{scenario != null && scenario <= 0 ? "NM" : formatPercent(vsPrice)}</dd>
              </div>
              <div>
                <dt>Terminal share</dt>
                <dd className={`figure${result.ok && result.terminalShare > 0.85 ? " tone-warn" : ""}`}>
                  {result.ok ? formatRate(result.terminalShare, 0) : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {result.ok ? (
            <div className="value-line" role="img" aria-label={`Scenario ${formatCurrency(scenario, 2, currency)}, base ${formatCurrency(baseValue, 2, currency)}${price ? `, market ${formatCurrency(price, 2, currency)}` : ""}`}>
              <div className="value-line-axis" />
              {scenario != null ? (
                <span
                  className="value-line-band"
                  style={{ left: pos(Math.min(baseValue, scenario)), width: `calc(${pos(Math.max(baseValue, scenario))} - ${pos(Math.min(baseValue, scenario))})` }}
                />
              ) : null}
              <span className="value-line-mark is-base" style={{ left: pos(baseValue) }}>
                <i>Base {formatCurrency(baseValue, 0, currency)}</i>
              </span>
              {price ? (
                <span className="value-line-mark is-price" style={{ left: pos(price) }}>
                  <i>Market {formatCurrency(price, 0, currency)}</i>
                </span>
              ) : null}
              {scenario != null ? <span className="value-line-dot" style={{ left: pos(scenario) }} /> : null}
            </div>
          ) : (
            <p className="notice notice-warn" role="alert">{result.reason}</p>
          )}
        </div>
      </div>
    </section>
  );
}
