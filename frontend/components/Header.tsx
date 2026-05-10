"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CandleLogo } from "@/components/CandleLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatTimestamp(date: Date): string {
  const dd = pad(date.getDate());
  const mm = pad(date.getMonth() + 1);
  const yy = String(date.getFullYear()).slice(-2);
  const hh = pad(date.getHours());
  const mn = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  let tz = "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZoneName: "short",
    }).formatToParts(date);
    tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    tz = "";
  }
  return `${dd}.${mm}.${yy} · ${hh}:${mn}:${ss}${tz ? " " + tz : ""}`;
}

export function Header() {
  // Empty initial state keeps SSR and first client render in sync; the timestamp
  // populates after mount so there's no hydration mismatch on the live clock.
  const [stamp, setStamp] = useState<string>("");

  useEffect(() => {
    const update = () => setStamp(formatTimestamp(new Date()));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  const monoStyle = {
    fontFamily:
      "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  } as const;

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between"
      style={{
        padding: "14px 32px",
        background: "var(--bg-header)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "0.5px solid var(--border-default)",
      }}
    >
      <div className="flex items-center" style={{ gap: 32 }}>
        <Link href="/" className="brand-link">
          <CandleLogo size={{ width: 26, height: 20 }} />
          <span className="brand-name">
            Valuation<span className="brand-suffix">.io</span>
          </span>
        </Link>

        <div
          className="flex items-center"
          style={{ ...monoStyle, fontSize: 11, letterSpacing: "0.04em" }}
        >
          <div className="ticker-cell">
            <span className="t-label">SPX</span>
            <span className="t-up">5847.32</span>
            <span className="t-up t-delta">+0.42</span>
          </div>
          <div className="ticker-cell">
            <span className="t-label">NDX</span>
            <span className="t-up">20418</span>
            <span className="t-up t-delta">+0.71</span>
          </div>
          <div className="ticker-cell">
            <span className="t-label">VIX</span>
            <span className="t-down">14.82</span>
          </div>
          <div className="ticker-cell">
            <span className="t-label">10Y</span>
            <span className="t-neutral">4.231</span>
          </div>
        </div>
      </div>

      <div className="flex items-center" style={{ gap: 18 }}>
        <span
          aria-label="Current time"
          suppressHydrationWarning
          style={{
            ...monoStyle,
            fontSize: 10,
            color: "var(--text-quaternary)",
            letterSpacing: "0.08em",
            fontVariantNumeric: "tabular-nums",
            minWidth: 180,
            textAlign: "right",
          }}
        >
          {stamp}
        </span>
        <a href="#" className="nav-link">
          Methodology
        </a>
        <Link href="/about" className="nav-link">
          About
        </Link>
        <a href="#" className="nav-link">
          Docs
        </a>
        <ThemeToggle />
        <span className="live-pill">
          <span className="live-dot" aria-hidden="true" />
          LIVE
        </span>
      </div>
    </header>
  );
}
