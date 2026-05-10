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
    <div
      className="flex justify-center items-center"
      style={{ paddingTop: 8 }}
    >
      <span
        style={{
          fontFamily:
            "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 10,
          color: "var(--text-quaternary)",
          letterSpacing: "0.1em",
          marginRight: 12,
        }}
      >
        RECENT
      </span>
      <div className="flex" style={{ gap: 5 }}>
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
