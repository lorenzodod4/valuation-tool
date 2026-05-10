import Link from "next/link";

interface ValuationSkeletonProps {
  ticker: string;
}

export function ValuationSkeleton({ ticker }: ValuationSkeletonProps) {
  return (
    <>
      <Link href="/" className="back-link">
        ← Back to search
      </Link>

      <div className="loading-indicator">
        LOADING {ticker.toUpperCase()}…
      </div>

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
      </div>
    </>
  );
}
