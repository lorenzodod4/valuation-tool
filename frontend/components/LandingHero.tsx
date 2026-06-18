"use client";

import { BorderGlow } from "@/components/BorderGlow";
import { DotField } from "@/components/DotField";
import { SearchBar } from "@/components/SearchBar";
import { TickerChips } from "@/components/TickerChips";

const HERO_BARS = [
  38, 44, 41, 50, 58, 53, 62, 68, 64, 72, 77, 70, 80, 86, 83, 92, 88, 96,
];

const PREVIEW_METRICS = [
  { label: "DCF range", value: "$168 - $214", tone: "neutral" },
  { label: "Peer median", value: "24.8x P/E", tone: "positive" },
  { label: "WACC", value: "8.7%", tone: "neutral" },
  { label: "Signal", value: "+12.4%", tone: "positive" },
];

const PREVIEW_RANGES = [
  { label: "DCF", low: 18, width: 54, tone: "cyan" },
  { label: "P/E", low: 32, width: 42, tone: "emerald" },
  { label: "EV/EBITDA", low: 25, width: 48, tone: "cyan" },
  { label: "EV/Sales", low: 12, width: 34, tone: "rose" },
];

export function LandingHero() {
  return (
    <section className="landing-entrance" aria-labelledby="entrance-title">
      <div
        className="landing-dotfield"
        aria-hidden="true"
      >
        <DotField
          dotRadius={1.45}
          dotSpacing={20}
          cursorRadius={400}
          bulgeStrength={40}
          glowRadius={200}
          gradientFrom="var(--dot-field-from)"
          gradientTo="var(--dot-field-to)"
          glowColor="var(--dot-field-glow)"
        />
      </div>

      <div className="landing-hero-container">
        <div className="entrance-copy">
          <div className="hero-anim-kicker hero-anim-1">
            <div className="kicker">
              <span className="kicker-line" aria-hidden="true" />
              <span className="kicker-text">PUBLIC EQUITY VALUATION WORKBENCH</span>
              <span className="kicker-line" aria-hidden="true" />
            </div>
          </div>

          <h1 id="entrance-title" className="landing-title">
            <span className="hero-word hero-anim-3">Institutional</span>{" "}
            <span className="hero-word hero-anim-4">valuation</span>{" "}
            <span className="hero-word hero-anim-5">workbench</span>{" "}
            <span className="hero-word hero-anim-6">for</span>{" "}
            <span className="hero-word hero-anim-7 hero-word-accent">public</span>{" "}
            <span className="hero-word hero-anim-8 hero-word-accent">equities.</span>
          </h1>

          <p className="landing-sub hero-anim-9">
            Run a first-pass public company valuation with DCF, peer
            multiples, reverse DCF, WACC transparency, and PDF-ready reporting.
          </p>
        </div>

        <div className="landing-dashboard-stack hero-anim-10">
          <BorderGlow
            className="home-glow-card terminal-glow hero-stage-card card-terminal"
            animated
          >
            <div className="hero-market-terminal">
              <div className="terminal-header">
                <span>REQUEST ANALYSIS</span>
                <span>US EQUITIES</span>
              </div>
              <div className="terminal-command-copy">
                <span>Enter ticker</span>
                <strong>Generate an institutional first-pass report.</strong>
              </div>
              <SearchBar />
              <TickerChips />
              <div className="terminal-scope-row" aria-label="Report scope">
                <span>DCF</span>
                <span>Comps</span>
                <span>Reverse DCF</span>
                <span>PDF</span>
              </div>
            </div>
          </BorderGlow>

          <BorderGlow
            className="home-glow-card preview-glow hero-stage-card card-preview"
          >
            <div
              className="hero-chart-panel"
              aria-label="Static valuation report preview"
            >
              <div className="hero-chart-header">
                <div>
                  <span className="panel-eyebrow">STATIC REPORT PREVIEW</span>
                  <h2>Valuation range monitor</h2>
                </div>
                <div className="panel-status">DELAYED DATA WHERE APPLICABLE</div>
              </div>

              <div className="hero-price-grid">
                <div>
                  <span className="preview-label">Illustrative fair value</span>
                  <strong>$192.40</strong>
                </div>
                <div>
                  <span className="preview-label">Current price</span>
                  <strong>$171.10</strong>
                </div>
                <div>
                  <span className="preview-label">Implied delta</span>
                  <strong className="positive-text">+12.4%</strong>
                </div>
              </div>

              <div className="market-bars" aria-hidden="true">
                {HERO_BARS.map((height, index) => (
                  <span
                    key={index}
                    className={index % 5 === 2 ? "market-bar down" : "market-bar up"}
                    style={{ 
                      height: `${height}px`,
                      ['--bar-index' as string]: index
                    }}
                  />
                ))}
              </div>

              <div className="preview-metrics">
                {PREVIEW_METRICS.map((metric, index) => (
                  <div 
                    key={metric.label} 
                    className="preview-metric"
                    style={{ ['--metric-index' as string]: index }}
                  >
                    <span>{metric.label}</span>
                    <strong className={`${metric.tone}-text`}>{metric.value}</strong>
                  </div>
                ))}
              </div>

              <div className="preview-report-grid">
                <div className="preview-range-card">
                  <span className="preview-label">Football field</span>
                  <div className="range-stack">
                    {PREVIEW_RANGES.map((range, index) => (
                      <div key={range.label} className="range-row">
                        <span>{range.label}</span>
                        <div className="range-track">
                          <i
                            className={`range-fill ${range.tone}`}
                            style={{ 
                              left: `${range.low}%`, 
                              width: `${range.width}%`,
                              ['--range-index' as string]: index
                            }}
                          />
                          <b />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="preview-note-card">
                  <span className="preview-label">Analyst controls</span>
                  <ul>
                    <li>Warnings remain visible.</li>
                    <li>Assumptions are documented.</li>
                    <li>Methodology is linked from the report.</li>
                    <li>Missing data is treated as a disclosure, not hidden.</li>
                  </ul>
                </div>
              </div>
            </div>
          </BorderGlow>
        </div>
      </div>
    </section>
  );
}
