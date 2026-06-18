import type { Metadata } from "next";
import { BorderGlow } from "@/components/BorderGlow";
import { AUTHOR } from "@/lib/author";
import Folder from "@/components/Folder";

export const metadata: Metadata = {
  title: "Methodology — Valuation.io",
  description:
    "How this tool computes DCF, multiples, and WACC. Methodology, formulas, and sources.",
};

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "dcf", label: "DCF" },
  { id: "ddm", label: "DDM" },
  { id: "reverse-dcf", label: "Reverse DCF" },
  { id: "wacc", label: "WACC" },
  { id: "multiples", label: "Multiples" },
  { id: "ranges", label: "Ranges" },
  { id: "limitations", label: "Limitations" },
  { id: "sources", label: "Sources" },
];

const MODEL_SUMMARY = [
  { label: "Primary methods", value: "DCF / DDM" },
  { label: "Forecast period", value: "5 years" },
  { label: "Model selection", value: "Sector-aware" },
  { label: "Reverse DCF", value: "Market-implied growth" },
];

const METHODOLOGY_META = [
  { label: "Provider", value: "Financial Modeling Prep" },
  { label: "Coverage", value: "US-listed equities" },
  { label: "Output", value: "Web + core PDF" },
  { label: "Use", value: "Educational only" },
];

const FORMULAS = [
  {
    title: "Free cash flow to firm",
    formula: "FCFF = NOPAT + D&A - CapEx - Delta WC",
    note: "NOPAT is EBIT multiplied by one minus the effective tax rate.",
  },
  {
    title: "Enterprise value",
    formula: "EV = Sum(FCFFt / (1 + WACC)^t) + TV / (1 + WACC)^5",
    note: "Terminal value uses the Gordon Growth Model after year 5.",
  },
  {
    title: "Terminal value",
    formula: "TV = FCFF5 x (1 + g) / (WACC - g)",
    note: "Terminal growth is treated as a long-term nominal growth proxy.",
  },
  {
    title: "WACC",
    formula: "WACC = (E/V) x Re + (D/V) x Rd x (1 - t)",
    note: "Cost of equity follows CAPM; cost of debt is derived from reported debt data where available.",
  },
];

export default function MethodologyPage() {
  return (
    <main className="methodology-page methodology-document">
      <div className="glow-1" aria-hidden="true" />
      <div className="glow-2" aria-hidden="true" />

      <div className="methodology-shell">
        <aside className="methodology-index" aria-label="Methodology sections">
          <div className="methodology-index-inner">
            <Folder 
              color="var(--accent)" 
              defaultOpen
              label="Methodology"
              items={SECTIONS.map((section, index) => (
                <a key={section.id} href={`#${section.id}`} className="folder-nav-item">
                  <span className="folder-nav-num">{String(index + 1).padStart(2, "0")}</span>
                  <span>{section.label}</span>
                </a>
              ))}
            />
            <div className="methodology-index-note">
              <span>VALUATION ENGINE V1.0.4</span>
              <a href={AUTHOR.linkedin}>Contact</a>
            </div>
          </div>
        </aside>

        <div className="methodology-content methodology-report">
          <header className="methodology-hero" id="overview">
            <div className="methodology-hero-copy">
              <div className="kicker">
                <span className="kicker-line" aria-hidden="true" />
                <span className="kicker-text">METHODOLOGY · VALUATION.IO</span>
                <span className="kicker-line" aria-hidden="true" />
              </div>
              <h1 className="about-title methodology-title">
                Institutional methodology note for valuation outputs.
              </h1>
              <p className="methodology-intro">
                This page documents how the frontend presents the valuation
                engine: sector-aware DCF or DDM model selection, WACC or cost
                of equity, trading comparables, valuation ranges, football
                field visualization, and known model limitations. It describes
                the current implementation and does not add unverified claims
                beyond the available calculation flow.
              </p>
              <div className="methodology-meta-strip" aria-label="Methodology metadata">
                {METHODOLOGY_META.map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="methodology-hero-aside" aria-label="Methodology summary">
              <div className="methodology-hero-note">
                <span className="section-kicker">MODEL SUMMARY</span>
                <p>
                  The goal is simple: keep the computation transparent, keep
                  the assumptions visible, and keep the presentation readable.
                </p>
              </div>

              <div className="method-summary-grid">
                {MODEL_SUMMARY.map((item) => (
                  <BorderGlow
                    key={item.label}
                    className="method-glow-card method-summary-glow"
                    fillOpacity={0.1}
                    glowRadius={18}
                  >
                    <div className="method-summary-card">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  </BorderGlow>
                ))}
              </div>
            </div>
          </header>

          <BorderGlow className="method-glow-card method-section-glow" fillOpacity={0.1}>
            <section className="method-section method-overview-card">
              <div>
                <span className="method-section-num">PROCESS</span>
                <h2 className="method-section-title">Valuation pipeline</h2>
                <p className="method-section-subtitle">
                  The report is designed to show calculated outputs together
                  with assumptions and caveats.
                </p>
              </div>
              <div className="method-pipeline">
                {["Input data", "Assumption engine", "Method selection", "Disclosure layer"].map(
                  (item, index) => (
                    <div key={item} className="pipeline-step">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{item}</strong>
                    </div>
                  ),
                )}
              </div>
            </section>
          </BorderGlow>

          <section className="method-section" id="dcf">
            <div className="method-section-num">01</div>
            <h2 className="method-section-title">Discounted Cash Flow</h2>
            <p className="method-section-subtitle">
              Intrinsic value from projected free cash flows discounted at the
              company&apos;s cost of capital.
            </p>
            <div className="method-body">
              <p>
                The DCF model projects free cash flow to the firm over a
                5-year window, then captures everything beyond year 5 with a
                terminal value computed via the Gordon Growth Model. Each
                year&apos;s cash flow is discounted at WACC to today&apos;s dollars.
              </p>
              <p>
                Free cash flow to the firm is calculated as NOPAT plus
                depreciation, minus capital expenditure, minus the change in
                working capital. NOPAT is EBIT multiplied by one minus the tax
                rate.
              </p>
              <div className="formula-grid">
                {FORMULAS.slice(0, 3).map((item) => (
                  <BorderGlow
                    key={item.title}
                    className="method-glow-card formula-glow"
                    fillOpacity={0.1}
                    glowRadius={18}
                  >
                    <article className="method-formula-card">
                      <span>{item.title}</span>
                      <code>{item.formula}</code>
                      <p>{item.note}</p>
                    </article>
                  </BorderGlow>
                ))}
              </div>
              <BorderGlow className="method-glow-card callout-glow" fillOpacity={0.1}>
                <div className="method-callout">
                  <strong>Auto-derived assumptions</strong>
                  <p>
                    Revenue growth starts from the company&apos;s 3-year historical
                    CAGR, capped at 15% and floored at terminal growth plus 1%.
                    Year 2 moves partway toward terminal growth, and years 3-5
                    interpolate down to the terminal growth rate. EBIT margin is
                    the 3-year average.
                  </p>
                </div>
              </BorderGlow>
              <p>
                Tax rate is derived from latest income tax expense divided by
                pre-tax income when available, clamped between 0% and 35%, with
                21% used as the fallback. D&amp;A, CapEx, and working capital
                changes are projected as percentages of revenue using the
                3-year average ratio.
              </p>
              <p>
                DCF is not the standard valuation methodology for banks,
                insurance companies, asset managers, or REITs. For these
                sectors, the tool can route to a Dividend Discount Model when
                the API returns the required dividend history. If the required
                inputs are incomplete, warnings remain visible in the report.
              </p>
            </div>
          </section>

          <section className="method-section" id="ddm">
            <div className="method-section-num">02</div>
            <h2 className="method-section-title">Dividend Discount Model</h2>
            <p className="method-section-subtitle">
              Dividend-based valuation for financial institutions, REITs, and
              other dividend-led cases where DCF is less appropriate.
            </p>
            <div className="method-body">
              <p>
                DDM projects dividends per share over a 5-year period, discounts
                them at cost of equity, and adds a Gordon Growth terminal value.
                It is used when the sector profile makes dividend streams more
                analytically relevant than free cash flow to firm.
              </p>
              <div className="formula-grid single">
                <BorderGlow className="method-glow-card formula-glow" fillOpacity={0.1}>
                  <article className="method-formula-card">
                    <span>Dividend value per share</span>
                    <code>Value = Sum(DPSt / (1 + Re)^t) + TV / (1 + Re)^5</code>
                    <p>
                      Cost of equity follows CAPM. Terminal value uses the
                      projected year-5 dividend and terminal dividend growth.
                    </p>
                  </article>
                </BorderGlow>
              </div>
              <p>
                DDM requires usable dividend history. Non-dividend-paying
                companies, sparse statements, or incomplete provider responses
                can make the model unavailable or less reliable.
              </p>
            </div>
          </section>

          <section className="method-section" id="reverse-dcf">
            <div className="method-section-num">03</div>
            <h2 className="method-section-title">Reverse DCF</h2>
            <p className="method-section-subtitle">
              Market-implied growth solved from the current trading price.
            </p>
            <div className="method-body">
              <p>
                Reverse DCF keeps the model&apos;s WACC, terminal growth, margins,
                reinvestment assumptions, and share count intact, then solves
                for the uniform forecast-period revenue growth rate that makes
                the DCF fair value equal the selected market price.
              </p>
              <div className="formula-grid single">
                <BorderGlow className="method-glow-card formula-glow" fillOpacity={0.1}>
                  <article className="method-formula-card">
                    <span>Market-implied growth</span>
                    <code>DCF fair value at solved growth = target market price</code>
                    <p>
                      The output is a reasonableness check: if the implied
                      growth rate is materially above the base DCF growth path,
                      the market is underwriting a stronger operating case than
                      the automated model.
                    </p>
                  </article>
                </BorderGlow>
              </div>
            </div>
          </section>

          <section className="method-section" id="wacc">
            <div className="method-section-num">04</div>
            <h2 className="method-section-title">WACC</h2>
            <p className="method-section-subtitle">
              Discount rate derived per ticker, with source transparency.
            </p>
            <div className="method-body">
              <p>
                Weighted Average Cost of Capital reflects the blended cost of
                equity and debt, weighted by capital structure. It is the core
                discount rate used to translate future cash flows into present
                value.
              </p>
              <div className="formula-grid single">
                <BorderGlow className="method-glow-card formula-glow" fillOpacity={0.1}>
                  <article className="method-formula-card">
                    <span>Weighted average cost of capital</span>
                    <code>{FORMULAS[3].formula}</code>
                    <p>{FORMULAS[3].note}</p>
                  </article>
                </BorderGlow>
              </div>
              <div className="assumption-grid">
                {[
                  ["Risk-free rate", "US 10-Year Treasury reference used by the model configuration where available."],
                  ["Equity risk premium", "Damodaran-style implied ERP reference from the current model configuration."],
                  ["Beta", "Company-specific beta sourced from Financial Modeling Prep where available."],
                  ["Tax rate", "Derived from reported tax expense over pre-tax income and capped at 0%-35%."],
                ].map(([label, text]) => (
                  <BorderGlow key={label} className="method-glow-card assumption-glow" fillOpacity={0.1}>
                    <div>
                      <span>{label}</span>
                      <p>{text}</p>
                    </div>
                  </BorderGlow>
                ))}
              </div>
            </div>
          </section>

          <section className="method-section" id="multiples">
            <div className="method-section-num">05</div>
            <h2 className="method-section-title">Trading Comparables</h2>
            <p className="method-section-subtitle">
              Market valuation derived from peer-group multiples applied to
              the target&apos;s financial metrics.
            </p>
            <div className="method-body">
              <p>
                The multiples method applies peer median trading multiples to
                the target company&apos;s own metrics. The report computes
                P/E, EV/EBITDA, EV/Sales, and P/B for the target and peers,
                then converts implied market cap or enterprise value to
                per-share value where applicable.
              </p>
              <pre className="method-formula">
{`Implied Market Cap = Peer median P/E x Target Net Income
Implied EV = Peer median EV/EBITDA x Target EBITDA
Implied per-share = Implied Market Cap / Shares Outstanding`}
              </pre>
              <p>
                Peers are sourced dynamically from Financial Modeling Prep and
                filtered for size quality. Companies below 1% or above 100x
                the target&apos;s market cap are excluded, then the top 5 by
                market cap are retained.
              </p>
            </div>
          </section>

          <section className="method-section" id="ranges">
            <div className="method-section-num">06</div>
            <h2 className="method-section-title">Valuation ranges and football field</h2>
            <p className="method-section-subtitle">
              Unified range presentation across methods, plotted against the
              current market price.
            </p>
            <div className="method-body">
              <p>
                The football field plots DCF, P/E-based, EV/EBITDA-based, and
                EV/Sales-based outputs on a horizontal range chart with a
                current price marker. The purpose is to show whether market
                price sits above, below, or inside the valuation reference
                range.
              </p>
              <p>
                The current implementation renders ranges where the valuation
                response provides low/high values. DCF uses a narrow WACC and
                terminal-growth corner sweep. Peer multiples use available
                peer percentile ranges. When ranges are not available, the
                chart degrades to a point estimate. A WACC and terminal-growth
                sensitivity table is implemented on the valuation page when
                the endpoint returns enough data.
              </p>
            </div>
          </section>

          <BorderGlow className="method-glow-card method-section-glow warning-glow" fillOpacity={0.1}>
            <section className="method-section method-limitations" id="limitations">
              <div className="method-section-num">07</div>
              <h2 className="method-section-title">Limitations and model risk</h2>
              <ul>
                <li>
                  Auto-derived assumptions are starting points, not conclusions.
                  A real analyst adjusts revenue growth, margins, reinvestment,
                  and WACC to reflect a business-specific thesis.
                </li>
                <li>
                  Free tier data from Financial Modeling Prep covers US-listed
                  equities. Non-US listings require broader data access and are
                  not supported here.
                </li>
                <li>
                  Recent IPOs, distressed issuers, financial institutions, REITs,
                  and companies with sparse statements can produce unreliable
                  automated assumptions.
                </li>
                <li>
                  Peer groups are algorithmically selected and size-filtered.
                  They are not a substitute for curated sector comparables.
                </li>
                <li>
                  Outputs are educational and not investment advice. They should
                  be treated as one analytical input among many.
                </li>
              </ul>
            </section>
          </BorderGlow>

          <div className="flex flex-col md:flex-row gap-12 items-start" id="sources">
            <section className="method-section method-sources flex-1">
              <div className="method-section-num">08</div>
              <h2 className="method-section-title">Data sources and status</h2>
              <div className="source-grid">
                {[
                  ["Implemented", "DCF, DDM, reverse DCF, WACC/cost of equity, trading comparables, football field, PDF."],
                  ["Provider data", "Financial Modeling Prep (FMP) /stable endpoints."],
                  ["External refs", "Risk-free rate and ERP references documented in the current model configuration."],
                ].map(([label, text]) => (
                  <BorderGlow key={label} className="method-glow-card source-glow" fillOpacity={0.1}>
                    <div>
                      <span>{label}</span>
                      <p className="text-xs">{text}</p>
                    </div>
                  </BorderGlow>
                ))}
              </div>
            </section>
          </div>

          <div className="method-footer">
            Methodology compiled by <strong>Lorenzo Dodero</strong>. Last
            revised June 2026. Spotted an error or have feedback? Reach out via{" "}
            <a
              href={AUTHOR.linkedin}
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
            .
          </div>
        </div>
      </div>
    </main>
  );
}
