"use client";

import { use, useCallback, useEffect, useState } from "react";
import {
  ApiError,
  fetchHistoricalFinancials,
  fetchReverseDCF,
  fetchSensitivity,
  getFullValuation,
  invalidateTicker,
  isAbortError,
} from "@/lib/api";
import type { Async } from "@/lib/async";
import type {
  FullValuation,
  HistoricalFinancials,
  ReverseDCFResult,
  SensitivityTable,
} from "@/types/valuation";
import { ValuationContent } from "@/components/ValuationContent";
import { ValuationError } from "@/components/ValuationError";
import { ValuationSkeleton } from "@/components/ValuationSkeleton";

interface ValuationPageProps {
  params: Promise<{ ticker: string }>;
}

interface LoadState {
  key: string;
  full: Async<FullValuation>;
  historical: Async<HistoricalFinancials>;
  sensitivity: Async<SensitivityTable>;
  reverseDcf: Async<ReverseDCFResult>;
}

const LOADING = { status: "loading" } as const;

function settle<T>(err: unknown): Async<T> {
  // 400 = the model cannot run on this data; 404/422 = not applicable here.
  if (err instanceof ApiError && [400, 404, 422].includes(err.status)) {
    return { status: "na", reason: err.message };
  }
  return { status: "error", error: err instanceof Error ? err : new Error("Request failed") };
}

export default function ValuationPage({ params }: ValuationPageProps) {
  const { ticker: rawTicker } = use(params);
  const ticker = decodeURIComponent(rawTicker).toUpperCase();
  const [attempt, setAttempt] = useState(0);
  const key = `${ticker}:${attempt}`;
  const [state, setState] = useState<LoadState | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const patch = (p: Partial<LoadState>) =>
      setState((prev) => {
        const base: LoadState =
          prev && prev.key === key
            ? prev
            : { key, full: LOADING, historical: LOADING, sensitivity: LOADING, reverseDcf: LOADING };
        return { ...base, ...p };
      });

    // All four start together; the backend coalesces them into one set of
    // provider requests. The report renders as soon as the primary arrives.
    getFullValuation(ticker, { signal }).then(
      (data) => patch({ full: { status: "ok", data } }),
      (err) => !isAbortError(err) && patch({ full: { status: "error", error: err } }),
    );
    fetchHistoricalFinancials(ticker, { signal }).then(
      (data) => patch({ historical: { status: "ok", data } }),
      (err) => !isAbortError(err) && patch({ historical: settle(err) }),
    );
    fetchSensitivity(ticker, { signal }).then(
      (data) => patch({ sensitivity: { status: "ok", data } }),
      (err) => !isAbortError(err) && patch({ sensitivity: settle(err) }),
    );
    fetchReverseDCF(ticker, undefined, { signal }).then(
      (data) => patch({ reverseDcf: { status: "ok", data } }),
      (err) => !isAbortError(err) && patch({ reverseDcf: settle(err) }),
    );

    return () => controller.abort();
  }, [ticker, key]);

  const retry = useCallback(() => {
    invalidateTicker(ticker);
    setAttempt((n) => n + 1);
  }, [ticker]);

  const current = state && state.key === key ? state : null;
  const full = current?.full ?? LOADING;

  return (
    <div className="report-page">
      {full.status === "loading" ? (
        <ValuationSkeleton ticker={ticker} />
      ) : full.status === "ok" ? (
        <ValuationContent
          data={full.data}
          historical={current?.historical ?? LOADING}
          sensitivity={current?.sensitivity ?? LOADING}
          reverseDcf={current?.reverseDcf ?? LOADING}
        />
      ) : full.status === "error" ? (
        <ValuationError ticker={ticker} error={full.error} onRetry={retry} />
      ) : null}
    </div>
  );
}
