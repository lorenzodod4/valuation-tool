"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Calculator, RotateCcw } from "lucide-react";
import type { ReverseDCFResult } from "@/types/valuation";
import { fetchReverseDCF } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/format";

interface ReverseDCFCardProps {
  ticker: string;
  currentPrice?: number | null;
  initialData?: ReverseDCFResult | null;
  onResultChange?: (result: ReverseDCFResult) => void;
}

function pctFmt(n: number | null | undefined, decimals: number = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(decimals)}%`;
}

export function ReverseDCFCard({
  ticker,
  currentPrice,
  initialData = null,
  onResultChange,
}: ReverseDCFCardProps) {
  const requestKey = `${ticker}:${currentPrice ?? "market"}`;
  const defaultTarget = currentPrice ?? initialData?.target_price ?? null;
  const defaultTargetText = defaultTarget != null ? defaultTarget.toFixed(2) : "";
  const [targetState, setTargetState] = useState({
    key: requestKey,
    value: defaultTargetText,
  });
  const targetInput =
    targetState.key === requestKey ? targetState.value : defaultTargetText;
  const [inputErrorState, setInputErrorState] = useState<{
    key: string;
    message: string | null;
  }>({ key: "", message: null });
  const inputError =
    inputErrorState.key === requestKey ? inputErrorState.message : null;
  const [fetchState, setFetchState] = useState<{
    key: string;
    data: ReverseDCFResult | null;
    error: string | null;
  }>({
    key: initialData ? requestKey : "",
    data: null,
    error: null,
  });
  const [customState, setCustomState] = useState<{
    key: string;
    data: ReverseDCFResult | null;
    error: string | null;
    loading: boolean;
  }>({
    key: "",
    data: null,
    error: null,
    loading: false,
  });
  const activeCustomState =
    customState.key === requestKey
      ? customState
      : { key: "", data: null, error: null, loading: false };

  useEffect(() => {
    if (initialData) {
      return;
    }

    let cancelled = false;

    fetchReverseDCF(ticker, currentPrice ?? undefined)
      .then((result) => {
        if (!cancelled) {
          setFetchState({ key: requestKey, data: result, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchState({
            key: requestKey,
            data: null,
            error: err instanceof Error ? err.message : "Failed to load reverse DCF",
          });
        }
      });

    return () => { cancelled = true; };
  }, [ticker, currentPrice, initialData, requestKey]);

  const fetchedForCurrentRequest = fetchState.key === requestKey;
  const baseData = initialData ?? (fetchedForCurrentRequest ? fetchState.data : null);
  const data = activeCustomState.data ?? baseData;
  const error =
    activeCustomState.error ??
    (initialData ? null : fetchedForCurrentRequest ? fetchState.error : null);
  const loading =
    !activeCustomState.data &&
    !initialData &&
    (!fetchedForCurrentRequest || (fetchState.data == null && fetchState.error == null));

  async function handleTargetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(targetInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setInputErrorState({
        key: requestKey,
        message: "Enter a positive target price.",
      });
      return;
    }

    setInputErrorState({ key: requestKey, message: null });
    setCustomState((prev) => ({
      ...prev,
      key: requestKey,
      error: null,
      loading: true,
    }));
    try {
      const result = await fetchReverseDCF(ticker, parsed);
      setCustomState({ key: requestKey, data: result, error: null, loading: false });
      onResultChange?.(result);
    } catch (err: unknown) {
      setCustomState({
        key: requestKey,
        data: null,
        error: err instanceof Error ? err.message : "Failed to run reverse DCF",
        loading: false,
      });
    }
  }

  function resetTarget() {
    setTargetState({ key: requestKey, value: defaultTargetText });
    setInputErrorState({ key: requestKey, message: null });
    setCustomState({ key: "", data: null, error: null, loading: false });
  }

  if (loading) {
    return (
      <div className="reverse-dcf-loading">
        <div className="skeleton-card" style={{ height: 200 }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="reverse-dcf-error">
        <p>Reverse DCF unavailable: {error || "No data"}</p>
      </div>
    );
  }

  const impliedGrowth = data.implied_growth_rate;
  const baseGrowth = data.base_assumptions_growth;
  const marginOfSafety = data.margin_of_safety;

  const growthDiff = baseGrowth != null ? impliedGrowth - baseGrowth : null;
  const solverStatus = data.solver_status ?? "solved";
  const solverTone =
    solverStatus === "solved"
      ? "var(--bull)"
      : solverStatus === "unstable" || solverStatus === "above_range"
        ? "var(--bear)"
        : "var(--amber)";
  const solverLabel = solverStatus.replace(/_/g, " ");

  // Color coding
  const impliedColor =
    impliedGrowth > 0.15
      ? "var(--bear)"
      : impliedGrowth > 0.08
        ? "var(--accent)"
        : "var(--bull)";

  const marginColor =
    marginOfSafety == null
      ? "var(--text-primary)"
      : marginOfSafety > 0
        ? "var(--bull)"
        : "var(--bear)";

  return (
    <div className="reverse-dcf-card">
      <div className="reverse-dcf-header">
        <p className="reverse-dcf-subtitle">
          What growth rate is the market pricing in at{" "}
          <strong>{formatCurrency(data.target_price ?? currentPrice)}</strong>?
        </p>
        <form onSubmit={handleTargetSubmit} className="reverse-dcf-form">
          <label className="reverse-dcf-input-label" htmlFor="reverse-target-price">
            Target price
          </label>
          <input
            id="reverse-target-price"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={targetInput}
            onChange={(event) => {
              setTargetState({ key: requestKey, value: event.target.value });
              if (inputError) {
                setInputErrorState({ key: requestKey, message: null });
              }
            }}
            className="reverse-dcf-input"
            disabled={activeCustomState.loading}
          />
          <button
            type="submit"
            className="reverse-dcf-action"
            disabled={activeCustomState.loading}
          >
            <Calculator size={14} strokeWidth={1.8} aria-hidden="true" />
            {activeCustomState.loading ? "Running" : "Run"}
          </button>
          {activeCustomState.data ? (
            <button
              type="button"
              className="reverse-dcf-action reverse-dcf-action-secondary"
              onClick={resetTarget}
              disabled={activeCustomState.loading}
            >
              <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
              Reset
            </button>
          ) : null}
        </form>
        {inputError ? (
          <p className="reverse-dcf-form-error" role="alert">
            {inputError}
          </p>
        ) : null}
        {activeCustomState.error ? (
          <p className="reverse-dcf-form-error" role="alert">
            {activeCustomState.error}
          </p>
        ) : null}
      </div>

      <div className="reverse-dcf-metrics">
        <div className="dcf-metric reverse-dcf-kpi">
          <div className="dcf-metric-label">Implied Growth Rate</div>
          <div className="dcf-metric-value" style={{ color: impliedColor }}>
            {pctFmt(impliedGrowth)}
          </div>
          <div className="dcf-metric-sub">Uniform Y1-Y5 revenue growth</div>
        </div>

        <div className="dcf-metric reverse-dcf-kpi">
          <div className="dcf-metric-label">Target Price</div>
          <div className="dcf-metric-value">
            {formatCurrency(data.target_price ?? currentPrice)}
          </div>
          <div className="dcf-metric-sub">Current market reference</div>
        </div>

        <div className="dcf-metric reverse-dcf-kpi">
          <div className="dcf-metric-label">Base Fair Value</div>
          <div className="dcf-metric-value">
            {formatCurrency(data.base_fair_value)}
          </div>
          <div className="dcf-metric-sub">Forward DCF result</div>
        </div>

        <div className="dcf-metric reverse-dcf-kpi">
          <div className="dcf-metric-label">Margin of Safety</div>
          <div className="dcf-metric-value" style={{ color: marginColor }}>
            {formatPercent(marginOfSafety)}
          </div>
          <div className="dcf-metric-sub">Base value vs market</div>
        </div>
      </div>

      <div className="reverse-dcf-context">
        <div className="reverse-dcf-params">
          <span className="reverse-dcf-param">
            Base growth: {pctFmt(baseGrowth)}
          </span>
          <span className="reverse-dcf-param">
            Growth gap: {growthDiff != null ? formatPercent(growthDiff) : "—"}
          </span>
          <span className="reverse-dcf-param">
            WACC: {pctFmt(data.wacc)}
          </span>
          <span className="reverse-dcf-param">
            Terminal Growth: {pctFmt(data.terminal_growth_rate)}
          </span>
          <span className="reverse-dcf-param" style={{ color: solverTone }}>
            Solver: {solverLabel}
          </span>
          <span className="reverse-dcf-param">
            Bounds: {pctFmt(data.growth_floor)} to {pctFmt(data.growth_ceiling)}
          </span>
          {data.fair_value_at_growth_floor != null &&
          data.fair_value_at_growth_ceiling != null ? (
            <span className="reverse-dcf-param">
              Bound values: {formatCurrency(data.fair_value_at_growth_floor)} to{" "}
              {formatCurrency(data.fair_value_at_growth_ceiling)}
            </span>
          ) : null}
        </div>
        <p className="reverse-dcf-export-note">
          PDF export uses the initial market-price Reverse DCF shown when this
          report loaded. Custom target runs stay interactive in this web view.
          Solver bounds are search limits; non-solved statuses reduce
          interpretability.
        </p>
      </div>

      <div className="reverse-dcf-interpretation">
        <div className="reverse-dcf-interpretation-label">Interpretation</div>
        <p className="reverse-dcf-interpretation-text">{data.interpretation}</p>
      </div>
    </div>
  );
}
