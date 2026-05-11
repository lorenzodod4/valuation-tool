import type { Metadata } from "next";
import { AUTHOR } from "@/lib/author";

export const metadata: Metadata = {
  title: "Methodology — Valuation.io",
  description:
    "How this tool computes DCF, multiples, and WACC. Methodology, formulas, and sources.",
};

export default function MethodologyPage() {
  return (
    <main className="methodology-page">
      <div className="glow-1" aria-hidden="true" />
      <div className="glow-2" aria-hidden="true" />

      <div className="methodology-content">
        <div className="kicker">
          <span className="kicker-line" aria-hidden="true" />
          <span className="kicker-text">METHODOLOGY · VALUATION.IO</span>
          <span className="kicker-line" aria-hidden="true" />
        </div>

        <h1 className="about-title">
          How this tool <span className="hero-gradient">computes</span>{" "}
          valuations.
        </h1>

        <p className="methodology-intro">
          Every number on this site is computed from publicly available
          financial data. This page documents the methodology behind each
          valuation method, the assumptions made, and the sources used. Read
          it once and you&apos;ll know exactly what the tool is doing under
          the hood.
        </p>

        <section className="method-section">
          <div className="method-section-num">01</div>
          <h2 className="method-section-title">Discounted Cash Flow</h2>
          <p className="method-section-subtitle">
            Intrinsic value from projected free cash flows discounted at the
            company&apos;s cost of capital.
          </p>
          <div className="method-body">
            <p>
              The DCF model projects free cash flow to the firm (FCFF) over a
              5-year window, then captures everything beyond year 5 with a
              terminal value computed via the Gordon Growth Model. Each
              year&apos;s cash flow is discounted at the weighted average cost
              of capital (WACC) to today&apos;s dollars.
            </p>
            <p>
              Free cash flow to the firm is calculated as NOPAT plus
              depreciation, minus capital expenditure, minus the change in
              working capital. NOPAT — net operating profit after tax — is
              EBIT × (1 − tax rate).
            </p>
            <pre className="method-formula">
{`FCFF = NOPAT + D&A − CapEx − ΔWC
NOPAT = EBIT × (1 − t)
Enterprise Value = Σ(FCFFₜ / (1 + WACC)ᵗ) + TV / (1 + WACC)⁵
TV = FCFF₅ × (1 + g) / (WACC − g)`}
            </pre>
            <p>
              Equity value is Enterprise Value minus net debt. Per-share value
              divides equity value by shares outstanding.
            </p>
            <p>
              <strong>Auto-derived assumptions:</strong> revenue growth tapers
              from the company&apos;s 3-year historical CAGR (capped at
              terminal growth + 1%) down to terminal growth by year 5. EBIT
              margin is the 3-year average. Tax rate is 21% (US corporate
              statutory). D&amp;A, CapEx, and working capital changes are
              projected as percentages of revenue, using the 3-year average
              ratio.
            </p>
            <p>
              <strong>Defaults:</strong> Terminal growth = 2.5% (long-term US
              GDP nominal growth proxy). WACC is computed per ticker — see
              WACC section below. All assumptions can be overridden via the{" "}
              <code className="method-inline-code">
                {"POST /api/valuation/{ticker}/dcf"}
              </code>{" "}
              endpoint.
            </p>
          </div>
        </section>

        <section className="method-section">
          <div className="method-section-num">02</div>
          <h2 className="method-section-title">Trading Comparables</h2>
          <p className="method-section-subtitle">
            Market valuation derived from peer-group multiples applied to the
            target&apos;s metrics.
          </p>
          <div className="method-body">
            <p>
              The multiples method values a company by applying the median
              trading multiple of a peer group to the target&apos;s own
              financial metrics. It&apos;s a sanity check against the DCF —
              different lens, different inputs.
            </p>
            <p>
              Four multiples are computed for the target and each peer:
              Price/Earnings (P/E), Enterprise Value/EBITDA (EV/EBITDA),
              Enterprise Value/Sales (EV/Sales), and Price/Book (P/B). The
              peer median for each multiple is then multiplied by the
              target&apos;s corresponding metric to yield an implied market
              cap or enterprise value, converted to per-share value.
            </p>
            <pre className="method-formula">
{`Implied Market Cap (P/E based) = Peer median P/E × Target Net Income
Implied EV (EV/EBITDA based) = Peer median EV/EBITDA × Target EBITDA
Implied per-share = Implied Market Cap / Shares Outstanding`}
            </pre>
            <p>
              <strong>Peer selection:</strong> peers are sourced dynamically
              from Financial Modeling Prep&apos;s stock-peers endpoint, then
              filtered for size quality (excluded if market cap is below 1%
              or above 100× the target&apos;s market cap). The top 5 by
              market cap are kept. This focuses comparisons on companies of
              similar scale and avoids spurious matches.
            </p>
            <p>
              <strong>Limitations:</strong> the multiples method is
              mechanical. It assumes that peer pricing is rational and that
              the target deserves to be valued like its peers. Both can be
              wrong. Use it as a triangulation tool, not a single answer.
            </p>
          </div>
        </section>

        <section className="method-section">
          <div className="method-section-num">03</div>
          <h2 className="method-section-title">Football Field</h2>
          <p className="method-section-subtitle">
            Unified view of valuation ranges across methods, plotted against
            the current market price.
          </p>
          <div className="method-body">
            <p>
              The football field is a visual summary used in investment
              banking pitch books. It plots each valuation method (DCF, P/E
              based, EV/EBITDA based, EV/Sales based) on a horizontal bar
              chart, with a vertical reference line marking the current
              market price. A glance tells you whether the market is pricing
              the company above, below, or in line with the methods.
            </p>
            <p>
              In a real pitch, each method would show a range (low–mid–high)
              reflecting different assumptions. This V1 of the tool shows a
              point estimate per method, computed under neutral assumptions.
              A sensitivity analysis layer is planned (see roadmap).
            </p>
          </div>
        </section>

        <section className="method-section">
          <div className="method-section-num">04</div>
          <h2 className="method-section-title">WACC</h2>
          <p className="method-section-subtitle">
            The discount rate, derived per ticker, with sources cited.
          </p>
          <div className="method-body">
            <p>
              The Weighted Average Cost of Capital is the rate at which a
              company&apos;s expected future cash flows are discounted to
              present value. It reflects the blended cost of equity and debt,
              weighted by their respective shares in the capital structure.
            </p>
            <pre className="method-formula">
{`WACC = (E/V) × Re + (D/V) × Rd × (1 − t)
Re = Rf + β × ERP   (CAPM)
Rd = Interest Expense / Total Debt`}
            </pre>
            <p>
              <strong>Sources for the inputs:</strong>
            </p>
            <ul>
              <li>
                <strong>Risk-free rate (Rf):</strong> US 10-Year Treasury
                yield. Currently 4.18%, as of January 2026. Source: Aswath
                Damodaran, NYU Stern.
              </li>
              <li>
                <strong>Equity risk premium (ERP):</strong> 4.23%. Source:
                Damodaran&apos;s Implied ERP, January 2026 update. Recomputed
                monthly by Damodaran from S&amp;P 500 cash flows and index
                level.
              </li>
              <li>
                <strong>Beta (β):</strong> company-specific, sourced from
                Financial Modeling Prep (typically 5-year monthly regression
                vs S&amp;P 500).
              </li>
              <li>
                <strong>Cost of debt (Rd):</strong> derived from each
                company&apos;s interest expense divided by total debt. Falls
                back to 4.5% (average US investment-grade corporate spread)
                when interest expense data is unavailable.
              </li>
              <li>
                <strong>Tax rate (t):</strong> derived from the company&apos;s
                latest reported income tax expense divided by pre-tax income.
                Capped at 0–35%.
              </li>
            </ul>
            <p>
              These inputs are updated periodically — typically every 3–6
              months — to match Damodaran&apos;s data refreshes. The
              valuation page shows whether the inputs are stale (older than
              180 days).
            </p>
            <p>
              <strong>Reference:</strong> Damodaran, A. (2026).{" "}
              <em>
                Equity Risk Premiums: Determinants, Estimates and Implications
                – The 2026 Edition.
              </em>{" "}
              SSRN.
            </p>
          </div>
        </section>

        <div className="method-limitations">
          <h2>Limitations &amp; honest notes</h2>
          <ul>
            <li>
              Auto-derived assumptions are starting points, not conclusions.
              A real analyst adjusts revenue growth, margins, and WACC to
              reflect their thesis on the business.
            </li>
            <li>
              Free tier data from FMP covers US-listed equities (NYSE,
              NASDAQ). Non-US listings require a premium subscription and
              are not supported.
            </li>
            <li>
              The model assumes 5 years of historical financial statements
              are available. For recent IPOs or small caps with limited
              history, auto-derived assumptions may be unreliable.
            </li>
            <li>
              Peer groups are algorithmically selected from FMP, then
              size-filtered. They&apos;re reasonable but not curated — a
              human analyst might choose different peers based on strategic
              similarity, not just size.
            </li>
            <li>
              This is an educational project. Outputs are not investment
              advice. Use them as one input among many in your own analysis.
            </li>
          </ul>
        </div>

        <div className="method-footer">
          Methodology compiled by <strong>Lorenzo Dodero</strong>. Last
          revised May 2026. Spotted an error or have feedback? Reach out via{" "}
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
    </main>
  );
}
