"use client";

import { use, useEffect, useState } from "react";
import { getFullValuation } from "@/lib/api";
import type { FullValuation } from "@/types/valuation";
import { ValuationContent } from "@/components/ValuationContent";
import { ValuationError } from "@/components/ValuationError";
import { ValuationSkeleton } from "@/components/ValuationSkeleton";

interface ValuationPageProps {
  params: Promise<{ ticker: string }>;
}

export default function ValuationPage({ params }: ValuationPageProps) {
  const { ticker: rawTicker } = use(params);
  const ticker = rawTicker.toUpperCase();

  const [data, setData] = useState<FullValuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getFullValuation(ticker)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load valuation.";
        setError(message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ticker]);

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
          <ValuationContent data={data} />
        ) : null}
      </div>
    </main>
  );
}
