"use client";

import Link from "next/link";

interface ValuationErrorProps {
  ticker: string;
  message: string;
}

function WarningIcon() {
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1={12} y1={9} x2={12} y2={13} />
      <line x1={12} y1={17} x2={12.01} y2={17} />
    </svg>
  );
}

export function ValuationError({ ticker, message }: ValuationErrorProps) {
  return (
    <div className="error-page">
      <span className="error-icon">
        <WarningIcon />
      </span>
      <h1 className="error-title">Could not load {ticker.toUpperCase()}</h1>
      <p className="error-message">{message}</p>
      <div className="error-actions">
        <Link href="/" className="btn-primary">
          Try a different ticker
        </Link>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
