"use client";

import { type FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";

const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,9}$/;
const SUGGESTIONS = ["AAPL", "MSFT", "NVDA", "JPM", "KO"];

interface SearchBarProps {
  autoFocus?: boolean;
  showSuggestions?: boolean;
  label?: string;
}

export function SearchBar({ autoFocus = false, showSuggestions = true, label = "Ticker symbol" }: SearchBarProps) {
  const router = useRouter();
  const errorId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function go(raw: string) {
    const ticker = raw.trim().toUpperCase();
    if (!TICKER_PATTERN.test(ticker)) {
      setError("Use 1–10 characters: letters, numbers, dot or hyphen.");
      return;
    }
    setError(null);
    setPending(true);
    router.push(`/valuation/${encodeURIComponent(ticker)}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    go(value);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="ticker-search" role="search">
        <Search className="ticker-search-icon" size={17} strokeWidth={1.8} aria-hidden="true" />
        <input
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value.toUpperCase());
            if (error) setError(null);
          }}
          placeholder="Enter a US ticker, e.g. AAPL"
          maxLength={10}
          autoFocus={autoFocus}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label={label}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          enterKeyHint="go"
        />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Opening…" : "Value it"}
          <ArrowRight size={15} strokeWidth={1.9} aria-hidden="true" />
        </button>
        {error ? (
          <p id={errorId} className="ticker-search-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
      {showSuggestions ? (
        <div className="ticker-suggestions">
          <span className="eyebrow">Try</span>
          {SUGGESTIONS.map((t) => (
            <button key={t} type="button" className="chip" onClick={() => go(t)}>
              {t}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
