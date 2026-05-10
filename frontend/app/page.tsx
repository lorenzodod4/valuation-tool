import Link from "next/link";
import { CandlestickBackground } from "@/components/CandlestickBackground";
import { FeatureCards } from "@/components/FeatureCards";
import { SearchBar } from "@/components/SearchBar";
import { TickerChips } from "@/components/TickerChips";
import { AUTHOR } from "@/lib/author";

export default function HomePage() {
  return (
    <main className="page-root">
      <CandlestickBackground />
      <div className="glow-1" aria-hidden="true" />
      <div className="glow-2" aria-hidden="true" />

      <div className="page-content">
        <a href="#" className="new-pill">
          <span className="new-badge">NEW</span>
          <span className="new-text">
            Multi-scenario DCF with sensitivity tables
          </span>
          <span className="new-arrow" aria-hidden="true">
            →
          </span>
        </a>

        <div className="kicker">
          <span className="kicker-line" aria-hidden="true" />
          <span className="kicker-text">EQUITY · DCF · MULTIPLES</span>
          <span className="kicker-line" aria-hidden="true" />
        </div>

        <h1 className="hero-title">
          Run a valuation
          <br />
          <span className="hero-gradient">in seconds.</span>
        </h1>

        <p className="hero-sub">
          Enter any US-listed ticker. Get DCF, comparable multiples, and a
          football-field summary, sourced from Yahoo Finance.
        </p>

        <div style={{ marginBottom: 18 }}>
          <SearchBar />
        </div>

        <div style={{ marginBottom: 96 }}>
          <TickerChips />
        </div>

        <FeatureCards />
      </div>

      <div className="footer-bar">
        <span>DATA · YAHOO FINANCE · DELAYED 15M</span>
        <Link href="/about" className="footer-credit">
          BUILT BY {AUTHOR.name.toUpperCase()}
        </Link>
        <span>EDUCATIONAL USE ONLY · NOT INVESTMENT ADVICE</span>
      </div>
    </main>
  );
}
