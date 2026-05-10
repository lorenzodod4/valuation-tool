"use client";

import Link from "next/link";

interface ValuationErrorProps {
  ticker: string;
  message: string;
  /** Optional override for the chips shown below the message. */
  suggestedTickers?: string[];
}

const PREMIUM_PATTERN = /not supported|premium|free tier/i;
const DEFAULT_SUGGESTIONS = ["AAPL", "NVDA", "JPM", "TSLA", "MSFT"];

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

export function ValuationError({
  ticker,
  message,
  suggestedTickers,
}: ValuationErrorProps) {
  const isPremium = PREMIUM_PATTERN.test(message);

  const title = isPremium
    ? "Ticker not supported"
    : `Could not load ${ticker.toUpperCase()}`;

  const displayMessage = isPremium
    ? "Free tier FMP doesn't cover this ticker. Try a US-listed equity (NYSE or NASDAQ)."
    : message;

  // Show chips when the caller passed some, OR when it's a premium error
  // (in which case we fall back to a curated default list).
  const chips =
    suggestedTickers && suggestedTickers.length > 0
      ? suggestedTickers
      : isPremium
        ? DEFAULT_SUGGESTIONS
        : null;

  return (
    <div className="error-page">
      <span className="error-icon">
        <WarningIcon />
      </span>
      <h1 className="error-title">{title}</h1>
      <p className="error-message">{displayMessage}</p>

      {chips ? (
        <div className="error-suggestions">
          <span className="error-suggestions-label">TRY</span>
          {chips.map((t) => (
            <Link
              key={t}
              href={`/valuation/${t}`}
              className="ticker-chip"
            >
              {t}
            </Link>
          ))}
        </div>
      ) : null}

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
