"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const TICKER_PATTERN = /^[A-Z0-9]{1,5}$/;

export function SearchBar() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ticker = value.trim().toUpperCase();
    if (!TICKER_PATTERN.test(ticker)) {
      setError("Please enter a valid ticker (1-5 letters/numbers)");
      return;
    }
    setError(null);
    router.push(`/valuation/${ticker}`);
  }

  return (
    <form onSubmit={handleSubmit} className="hero-search-form">
      <span className="hero-label" aria-hidden="true">
        TICKER
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value.toUpperCase())}
        placeholder="AAPL"
        maxLength={5}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Ticker symbol"
        className="hero-input"
      />
      <button type="submit" className="hero-btn">
        ANALYZE
        <span className="hero-arrow" aria-hidden="true">
          →
        </span>
      </button>
      {error ? (
        <p className="hero-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
