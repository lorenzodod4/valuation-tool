"use client";

import Link from "next/link";
import { ArrowLeft, CircleSlash, Clock, RotateCcw, SearchX, WifiOff } from "lucide-react";
import { ApiError } from "@/lib/api";
import { SearchBar } from "@/components/SearchBar";

interface ValuationErrorProps {
  ticker: string;
  error: Error;
  onRetry: () => void;
}

function describe(ticker: string, error: Error) {
  const kind = error instanceof ApiError ? error.kind : "server";
  switch (kind) {
    case "not_found":
      return { icon: SearchX, title: `We couldn't find ${ticker}`, body: "Check the symbol — this tool covers US-listed equities on NYSE and NASDAQ.", retry: false };
    case "unsupported":
      return { icon: CircleSlash, title: `${ticker} isn't covered`, body: "The free data tier covers most US large- and mid-caps. Non-US listings and some recent IPOs are not available.", retry: false };
    case "invalid":
      return { icon: CircleSlash, title: "That doesn't look like a ticker", body: error.message, retry: false };
    case "quota":
      return { icon: Clock, title: "Daily data budget reached", body: error.message, retry: false };
    case "rate_limited":
      if (/new tickers/i.test(error.message)) {
        return { icon: Clock, title: "New-ticker limit reached", body: error.message, retry: false };
      }
      return { icon: Clock, title: "Too many requests", body: "Please wait a few seconds before trying again.", retry: true };
    case "network":
      return { icon: WifiOff, title: "Can't reach the valuation server", body: "Check your connection, or try again in a moment — the server may be waking up.", retry: true };
    default:
      return { icon: CircleSlash, title: `Couldn't analyse ${ticker} right now`, body: error.message, retry: true };
  }
}

export function ValuationError({ ticker, error, onRetry }: ValuationErrorProps) {
  const d = describe(ticker, error);
  const Icon = d.icon;
  const retryAfter = error instanceof ApiError ? error.retryAfterSeconds : null;

  return (
    <div className="container error-state">
      <Link href="/" className="back-link">
        <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
        New analysis
      </Link>
      <div className="error-card panel" role="alert">
        <Icon size={22} strokeWidth={1.6} aria-hidden="true" className="error-icon" />
        <h1>{d.title}</h1>
        <p>{d.body}</p>
        {retryAfter && d.retry ? <p className="tone-muted">Suggested wait: about {Math.ceil(retryAfter)} seconds.</p> : null}
        <div className="error-actions">
          {d.retry ? (
            <button type="button" className="btn btn-primary" onClick={onRetry}>
              <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" /> Try again
            </button>
          ) : null}
        </div>
        <div className="error-search">
          <SearchBar label="Try another ticker" />
        </div>
      </div>
    </div>
  );
}
