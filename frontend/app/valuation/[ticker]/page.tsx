"use client";

import { use, useEffect, useState } from "react";
import {
  fetchHistoricalFinancials,
  fetchReverseDCF,
  fetchSensitivity,
  getFullValuation,
} from "@/lib/api";
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

interface ValuationLoadState {
  ticker: string;
  data: FullValuation | null;
  historical: HistoricalFinancials | null;
  reverseDcf: ReverseDCFResult | null;
  sensitivity: SensitivityTable | null;
  error: string | null;
}

export default function ValuationPage({ params }: ValuationPageProps) {
  const { ticker: rawTicker } = use(params);
  const ticker = rawTicker.toUpperCase();

  const [loadState, setLoadState] = useState<ValuationLoadState | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    Promise.all([
      // Primary fetch — if this fails the whole page errors out.
      getFullValuation(ticker, { signal }),
      // Best-effort fetches — section silently skipped on failure.
      fetchHistoricalFinancials(ticker, { signal }).catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        return null;
      }),
      fetchSensitivity(ticker, { signal }).catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        return null;
      }),
      fetchReverseDCF(ticker, undefined, { signal }).catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        return null;
      }),
    ])
      .then(([valuation, hist, sens, reverseDcf]) => {
        if (signal.aborted) return;
        setLoadState({
          ticker,
          data: valuation,
          historical: hist,
          reverseDcf,
          sensitivity: sens,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "Failed to load valuation.";
        setLoadState({
          ticker,
          data: null,
          historical: null,
          reverseDcf: null,
          sensitivity: null,
          error: message,
        });
      });

    return () => {
      abortController.abort();
    };
  }, [ticker]);

  const loading = loadState?.ticker !== ticker;
  const data = loading ? null : loadState?.data ?? null;
  const historical = loading ? null : loadState?.historical ?? null;
  const reverseDcf = loading ? null : loadState?.reverseDcf ?? null;
  const sensitivity = loading ? null : loadState?.sensitivity ?? null;
  const error = loading ? null : loadState?.error ?? null;

  return (
    <main className="valuation-page">
      <div className="glow-1" aria-hidden="true" />
      <div className="glow-2" aria-hidden="true" />
      <div className="valuation-content">
        {loading ? (
          <ValuationSkeleton ticker={ticker} />
        ) : error ? (
          <ValuationError ticker={ticker} message={error} />
        ) : data ? (
          <ValuationContent
            data={data}
            historical={historical}
            reverseDcf={reverseDcf}
            sensitivity={sensitivity}
          />
        ) : null}
      </div>
    </main>
  );
}
