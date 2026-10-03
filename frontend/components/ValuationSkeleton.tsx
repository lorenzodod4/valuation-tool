"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Fetching profile and quote",
  "Loading five years of statements",
  "Deriving assumptions and WACC",
  "Running valuation models",
  "Benchmarking against peers",
];

export function ValuationSkeleton({ ticker }: { ticker: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="container report-loading" aria-busy="true">
      <div className="report-loading-head">
        <span className="report-symbol mono">{ticker}</span>
        <p className="report-loading-status" role="status" aria-live="polite">
          {STEPS[step]}…
        </p>
        <ol className="report-loading-steps" aria-hidden="true">
          {STEPS.map((s, i) => (
            <li key={s} data-state={i < step ? "done" : i === step ? "active" : "todo"} />
          ))}
        </ol>
        <p className="tone-muted report-loading-hint">
          First analysis of a ticker can take a few seconds; repeat visits are served from cache.
        </p>
      </div>
      <div className="summary-strip">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="summary-item">
            <div className="skeleton" style={{ height: 12, width: "50%" }} />
            <div className="skeleton" style={{ height: 30, width: "80%", marginTop: 12 }} />
          </div>
        ))}
      </div>
      <div className="skeleton" style={{ height: 260, marginTop: 48, borderRadius: 14 }} />
      <div className="skeleton" style={{ height: 380, marginTop: 24, borderRadius: 14 }} />
    </div>
  );
}
