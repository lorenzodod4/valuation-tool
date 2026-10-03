"use client";

import { type FormEvent, useId, useState } from "react";
import { Calculator, RotateCcw } from "lucide-react";
import type { ReverseDCFResult } from "@/types/valuation";
import { fetchReverseDCF } from "@/lib/api";
import { formatCurrency, formatPercent, formatRate, toneOf } from "@/lib/format";

interface ReverseDCFCardProps {
  ticker: string;
  currency?: string | null;
  initialData: ReverseDCFResult;
  onResultChange?: (result: ReverseDCFResult | null) => void;
}

const STATUS: Record<string, { label: string; badge: string; note: string }> = {
  solved: { label: "Solved", badge: "badge-pos", note: "The solver found a growth rate inside its search range." },
  above_range: { label: "Above range", badge: "badge-warn", note: "The price needs more growth than the 50% ceiling — read the rate as a lower bound." },
  below_range: { label: "Below range", badge: "badge-warn", note: "The price is justified even at the −10% floor — the valuation is not growth-constrained." },
  unstable: { label: "Unstable", badge: "badge-neg", note: "Cash flows do not produce a clean growth-to-value relationship; the rate shown is the base assumption, not a solution." },
};

export function ReverseDCFCard({ ticker, currency, initialData, onResultChange }: ReverseDCFCardProps) {
  const inputId = useId();
  const [custom, setCustom] = useState<ReverseDCFResult | null>(null);
  const [input, setInput] = useState(initialData.target_price.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const data = custom ?? initialData;
  const status = STATUS[data.solver_status] ?? STATUS.unstable;
  const gap = data.base_assumptions_growth != null ? data.implied_growth_rate - data.base_assumptions_growth : null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const target = Number(input);
    if (!Number.isFinite(target) || target <= 0 || target > 10_000_000) {
      setError("Enter a positive price.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await fetchReverseDCF(ticker, target);
      setCustom(result);
      onResultChange?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reverse DCF failed.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setCustom(null);
    setInput(initialData.target_price.toFixed(2));
    setError(null);
    onResultChange?.(null);
  }

  return (
    <div className="model-card">
      <dl className="kpi-row">
        <div className="kpi">
          <dt>Implied revenue growth</dt>
          <dd className="figure">{formatRate(data.implied_growth_rate, 1)}</dd>
          <dd className="kpi-note">uniform, Y1–Y5</dd>
        </div>
        <div className="kpi">
          <dt>Model base growth (Y1)</dt>
          <dd className="figure">{formatRate(data.base_assumptions_growth, 1)}</dd>
          <dd className="kpi-note">
            Gap <span className="num">{gap == null ? "—" : `${formatPercent(gap).replace("%", "")} pts`}</span>
          </dd>
        </div>
        <div className="kpi">
          <dt>Price tested</dt>
          <dd className="figure">{formatCurrency(data.target_price, 2, currency)}</dd>
          <dd className="kpi-note">{custom ? "Custom target" : "Market price"}</dd>
        </div>
        <div className="kpi">
          <dt>Base DCF vs price</dt>
          <dd className={`figure tone-${toneOf(data.margin_of_safety)}`}>{formatPercent(data.margin_of_safety)}</dd>
          <dd className="kpi-note">{formatCurrency(data.base_fair_value, 2, currency)} base value</dd>
        </div>
      </dl>

      <div className="reverse-status">
        <span className={`badge ${status.badge}`}>{status.label}</span>
        <p>
          {status.note} {data.interpretation}
        </p>
      </div>

      <form className="inline-form" onSubmit={submit}>
        <div className="field">
          <label className="field-label" htmlFor={inputId}>Test another price ({currency ?? "USD"})</label>
          <input
            id={inputId}
            className="input num"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={input}
            aria-invalid={Boolean(error)}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError(null);
            }}
            disabled={loading}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          <Calculator size={14} strokeWidth={1.8} aria-hidden="true" />
          {loading ? "Solving…" : "Solve"}
        </button>
        {custom ? (
          <button type="button" className="btn btn-ghost" onClick={reset} disabled={loading}>
            <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" /> Market price
          </button>
        ) : null}
      </form>
      {error ? <p className="field-error" role="alert">{error}</p> : null}

      <p className="table-footnote">
        Search range {formatRate(data.growth_floor, 0)} to {formatRate(data.growth_ceiling, 0)}
        {data.fair_value_at_growth_floor != null && data.fair_value_at_growth_ceiling != null
          ? ` (values ${formatCurrency(data.fair_value_at_growth_floor, 2, currency)} to ${formatCurrency(data.fair_value_at_growth_ceiling, 2, currency)})`
          : ""}
        . WACC {formatRate(data.wacc)}, terminal growth {formatRate(data.terminal_growth_rate)} held constant.
        {custom ? " The PDF export uses the price tested here." : ""}
      </p>
    </div>
  );
}
