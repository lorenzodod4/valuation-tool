"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";

const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,9}$/;

export function SearchBar() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ticker = value.trim().toUpperCase();
    if (!TICKER_PATTERN.test(ticker)) {
      setError("Use 1-10 characters: letters, numbers, dot, or hyphen.");
      return;
    }
    setError(null);
    router.push(`/valuation/${ticker}`);
  }

  return (
    <form onSubmit={handleSubmit} className="hero-search-form">
      <span className="hero-label" aria-hidden="true">
        <Search size={14} strokeWidth={1.8} />
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => {
          setValue(event.target.value.toUpperCase());
          if (error) setError(null);
        }}
        placeholder="AAPL"
        maxLength={10}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Ticker symbol"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "ticker-search-error" : undefined}
        className="hero-input"
      />
      <button type="submit" className="hero-btn">
        ANALYZE
        <ArrowRight className="hero-arrow" size={15} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {error ? (
        <p id="ticker-search-error" className="hero-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
