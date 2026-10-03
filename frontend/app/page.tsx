import Link from "next/link";
import { ArrowUpRight, Database, Gauge, ShieldCheck, TriangleAlert } from "lucide-react";
import { HeroPoster } from "@/components/hero/HeroPoster";
import { HeroScene } from "@/components/hero/HeroScene";
import { ValuationDemo } from "@/components/landing/ValuationDemo";
import { Reveal } from "@/components/Reveal";
import { SearchBar } from "@/components/SearchBar";

const PIPELINE = [
  { n: "01", title: "Ticker", body: "Any US-listed equity on NYSE or NASDAQ." },
  { n: "02", title: "Statements", body: "Five years of income, balance sheet and cash flow, plus trailing ratios." },
  { n: "03", title: "Assumptions", body: "Growth, margins, reinvestment and a CAPM discount rate, derived from history and shown." },
  { n: "04", title: "Models", body: "DCF or DDM by sector, reverse DCF, peer multiples and a sensitivity grid." },
  { n: "05", title: "Range", body: "One football field against the market price, exportable as a PDF." },
];

const METHODS = [
  {
    name: "Discounted cash flow",
    tag: "Operating companies",
    formula: "EV = Σ FCFFₜ ⁄ (1+WACC)ᵗ + TV ⁄ (1+WACC)⁵",
    body: "Five-year free cash flow to the firm with a Gordon-growth terminal value, then net debt to equity per share.",
  },
  {
    name: "Dividend discount",
    tag: "Banks, insurers, REITs",
    formula: "P = Σ DPSₜ ⁄ (1+Rₑ)ᵗ + TV ⁄ (1+Rₑ)⁵",
    body: "Selected automatically where free cash flow is not meaningful, discounted at the CAPM cost of equity.",
  },
  {
    name: "Reverse DCF",
    tag: "Market expectations",
    formula: "solve g : DCF(g) = price",
    body: "The uniform revenue growth the current share price already assumes — with the solver status disclosed.",
  },
  {
    name: "Trading comparables",
    tag: "Relative value",
    formula: "value = median multiple × metric",
    body: "P/E, EV/EBITDA and EV/Sales from a size-filtered peer set, with quartile ranges. Negative multiples are excluded.",
  },
];

const GUARDRAILS = [
  { icon: TriangleAlert, title: "Sanity checks, surfaced", body: "Anomalous margins, out-of-range ratios and extreme divergence from the market are flagged in the report — never silently corrected." },
  { icon: Database, title: "Missing data is a disclosure", body: "Absent line items stay absent. Defaults are named, partial results are labelled, and a model that cannot run says why." },
  { icon: Gauge, title: "Inputs carry dates", body: "The risk-free rate (US 10-year Treasury) and Damodaran's equity risk premium are dated; quote timestamps and stale-data warnings are shown." },
  { icon: ShieldCheck, title: "Built for scarce data", body: "Server-side keys, cached and de-duplicated provider requests, and bounded retries keep the data budget for real analysis." },
];

export default function HomePage() {
  return (
    <div className="landing">
      <section className="hero" aria-labelledby="hero-title">
        <HeroScene poster={<HeroPoster />} />
        <div className="hero-veil" aria-hidden="true" />
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow fade-up" style={{ ["--i" as string]: 0 }}>
              <span className="eyebrow-dot" aria-hidden="true" />
              Equity valuation · first pass in seconds
            </p>
            <h1 id="hero-title" className="hero-title fade-up" style={{ ["--i" as string]: 1 }}>
              From the whole market <span className="serif-accent">to what one stock is worth.</span>
            </h1>
            <p className="lede fade-up" style={{ ["--i" as string]: 2 }}>
              Type a ticker. Statements, peers and cost of capital become a DCF, a reverse DCF and a football
              field — with every assumption on the page, and every caveat in plain sight.
            </p>
            <div id="analyze" className="hero-search fade-up" style={{ ["--i" as string]: 3 }}>
              <SearchBar />
            </div>
          </div>
          <p className="hero-hint fade-up" style={{ ["--i" as string]: 4 }}>
            Move the cursor through the particles · switch acts below
          </p>
        </div>
      </section>

      <section className="container landing-section" aria-labelledby="pipeline-title">
        <Reveal className="section-head">
          <p className="eyebrow"><span className="eyebrow-index">01</span> How it works</p>
          <h2 id="pipeline-title" className="section-title">
            From ticker to valuation range, in one controlled sequence.
          </h2>
        </Reveal>
        <Reveal as="div" className="pipeline">
          <ol>
            {PIPELINE.map((step) => (
              <li key={step.n} className="pipeline-step">
                <span className="pipeline-n num">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      <section className="container landing-section" aria-labelledby="demo-title">
        <Reveal className="section-head section-head-split">
          <div>
            <p className="eyebrow"><span className="eyebrow-index">02</span> Try the engine</p>
            <h2 id="demo-title" className="section-title">
              Move an assumption. <span className="serif-accent">Watch the value move.</span>
            </h2>
          </div>
          <p className="lede">
            The same five-year model that runs on live tickers, here on an illustrative company. Notice how
            much of the value sits in the terminal year — and how little a discount-rate change it takes to
            move it.
          </p>
        </Reveal>
        <Reveal>
          <ValuationDemo />
        </Reveal>
      </section>

      <section className="container landing-section" aria-labelledby="methods-title">
        <Reveal className="section-head">
          <p className="eyebrow"><span className="eyebrow-index">03</span> Methodology</p>
          <h2 id="methods-title" className="section-title">Four lenses on one number.</h2>
        </Reveal>
        <div className="methods-grid">
          {METHODS.map((m) => (
            <Reveal key={m.name} className="method-card panel">
              <span className="badge">{m.tag}</span>
              <h3>{m.name}</h3>
              <p className="method-formula mono">{m.formula}</p>
              <p>{m.body}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className="methods-link">
          <Link href="/methodology" className="btn btn-secondary">
            Read the full methodology
            <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </Reveal>
      </section>

      <section className="container landing-section" aria-labelledby="trust-title">
        <Reveal className="section-head section-head-split">
          <div>
            <p className="eyebrow"><span className="eyebrow-index">04</span> Data &amp; guardrails</p>
            <h2 id="trust-title" className="section-title">A number is only as good as what it admits.</h2>
          </div>
          <p className="lede">
            Fundamentals and trailing ratios come from Financial Modeling Prep. The cost of capital uses
            the US 10-year Treasury yield and the implied equity risk premium of Aswath Damodaran (NYU Stern). Outputs are a starting point for analysis,
            not investment advice.
          </p>
        </Reveal>
        <div className="guardrails">
          {GUARDRAILS.map(({ icon: Icon, title, body }) => (
            <Reveal key={title} className="guardrail">
              <Icon size={18} strokeWidth={1.6} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container" aria-labelledby="cta-title">
        <Reveal className="cta panel">
          <div>
            <h2 id="cta-title" className="section-title">
              Start with a ticker. <span className="serif-accent">Then argue with it.</span>
            </h2>
            <p className="lede">US-listed equities · results in seconds · PDF report included.</p>
          </div>
          <SearchBar showSuggestions={false} label="Ticker symbol (call to action)" />
        </Reveal>
      </section>
    </div>
  );
}
