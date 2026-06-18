"use client";

import { useRouter } from "next/navigation";

const DEFAULT_TICKERS = [
  "AAPL",
  "NVDA",
  "JPM",
  "TSLA",
  "GS",
  "AMD",
  "META",
  "JNJ",
];

interface TickerChipsProps {
  tickers?: string[];
}

export function TickerChips({ tickers = DEFAULT_TICKERS }: TickerChipsProps) {
  const router = useRouter();

  return (
    <div className="ticker-chips">
      <span className="ticker-chips-label">RECENT</span>
      <div className="ticker-chips-list">
        {tickers.map((ticker) => (
          <button
            key={ticker}
            type="button"
            className="ticker-chip"
            onClick={() => router.push(`/valuation/${ticker}`)}
          >
            {ticker}
          </button>
        ))}
      </div>
    </div>
  );
}
