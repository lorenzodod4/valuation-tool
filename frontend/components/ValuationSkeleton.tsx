"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ValuationSkeletonProps {
  ticker: string;
}

const LOADING_MESSAGES = [
  "Fetching company profile…",
  "Loading financial statements…",
  "Computing DCF model…",
  "Comparing with peers…",
  "Building football field…",
];
const MESSAGE_INTERVAL_MS = 2500;

function LoadingProgress() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Walk through the message list and stop at the last one — the real data
    // usually arrives before we exhaust it, but if it doesn't, "building
    // football field…" is a reasonable terminal state to dwell on.
    const timer = setInterval(() => {
      setIndex((prev) =>
        prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev,
      );
    }, MESSAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="loading-progress" aria-live="polite">
      <span key={index} className="loading-progress-text">
        {LOADING_MESSAGES[index]}
      </span>
    </div>
  );
}

export function ValuationSkeleton({ ticker }: ValuationSkeletonProps) {
  return (
    <>
      <Link href="/" className="back-link">
        ← Back to search
      </Link>

      <div className="loading-indicator">LOADING {ticker.toUpperCase()}…</div>

      <LoadingProgress />

      <div className="ticker-header">
        <div className="ticker-header-left">
          <div className="skeleton-bar" style={{ width: 200, height: 40 }} />
          <div
            className="skeleton-bar"
            style={{ width: 280, height: 20, marginTop: 12 }}
          />
          <div
            className="skeleton-bar"
            style={{ width: 220, height: 12, marginTop: 12 }}
          />
        </div>
        <div className="ticker-header-right">
          <div className="skeleton-bar" style={{ width: 140, height: 32 }} />
          <div
            className="skeleton-bar"
            style={{ width: 100, height: 14, marginTop: 16 }}
          />
        </div>
      </div>

      <div className="valuation-sections">
        <div className="skeleton-card" />
        <div className="skeleton-card" />
        <div className="skeleton-card" />
        <div className="skeleton-card skeleton-card-chart" />
        <div className="skeleton-card skeleton-card-grid" />
        <div className="skeleton-card" />
      </div>
    </>
  );
}
