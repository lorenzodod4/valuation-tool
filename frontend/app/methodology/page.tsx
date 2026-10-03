import type { Metadata } from "next";
import Link from "next/link";
import { AUTHOR } from "@/lib/author";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How Valuation.io computes DCF, DDM, reverse DCF, WACC, trading comparables, sensitivity and valuation ranges — formulas, defaults, data sources and limitations.",
};

const SECTIONS = [
  { id: "pipeline", label: "Pipeline" },
  { id: "dcf", label: "Discounted cash flow" },
  { id: "ddm", label: "Dividend discount" },
  { id: "reverse-dcf", label: "Reverse DCF" },
  { id: "wacc", label: "Discount rate" },
  { id: "multiples", label: "Comparables" },
  { id: "ranges", label: "Ranges & sensitivity" },
  { id: "data", label: "Data & freshness" },
  { id: "limitations", label: "Limitations" },
];

function Formula({ children, note }: { children: string; note?: string }) {
  return (
    <figure className="doc-formula">
      <pre className="mono">{children}</pre>
      {note ? <figcaption>{note}</figcaption> : null}
    </figure>
  );
}

function DefaultsTable({ rows }: { rows: Array<[string, string, string]> }) {
  return (
    <div className="table-scroll">
      <table className="data-table doc-table">
        <thead>
          <tr>
            <th scope="col">Input</th>
            <th scope="col">Rule</th>
            <th scope="col">Fallback</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b, c]) => (
            <tr key={a}>
              <th scope="row">{a}</th>
              <td>{b}</td>
              <td className="tone-muted">{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <div className="container doc">
      <header className="doc-header">
        <p className="eyebrow">Methodology note</p>
        <h1 className="doc-title">
          How the numbers are made — <span className="serif-accent">and where they break.</span>
        </h1>
        <p className="lede">
          Every figure in a report comes from the calculation flow described here. Defaults are named, fallbacks are
          disclosed in the report, and nothing is adjusted silently.
        </p>
        <dl className="doc-meta">
          <div><dt>Provider</dt><dd>Financial Modeling Prep</dd></div>
          <div><dt>Coverage</dt><dd>US-listed equities</dd></div>
          <div><dt>Horizon</dt><dd>5 years + terminal</dd></div>
          <div><dt>Use</dt><dd>Educational only</dd></div>
        </dl>
      </header>

      <div className="doc-layout">
        <nav className="doc-toc" aria-label="On this page">
          <p className="eyebrow">On this page</p>
          <ol>
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>
                  <span className="num">{String(i + 1).padStart(2, "0")}</span>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="doc-body">
          <section id="pipeline">
            <h2>Pipeline</h2>
            <p>
              A report runs in four steps: <strong>collect</strong> the profile, five annual statements and trailing
              ratios; <strong>derive</strong> assumptions from that history; <strong>value</strong> the company with
              the model suited to its sector, plus peer multiples; and <strong>disclose</strong> every default,
              sanity-check flag and missing input alongside the result.
            </p>
            <p>
              Operating companies are valued with a discounted cash flow. Companies in the Financial Services and Real
              Estate sectors are valued with a dividend discount model, because free cash flow is not a meaningful
              measure of value for banks, insurers or REITs. Trading comparables run for every company.
            </p>
          </section>

          <section id="dcf">
            <h2>Discounted cash flow</h2>
            <p>
              Free cash flow to the firm is projected for five years and discounted at WACC; everything beyond year five
              is captured by a Gordon-growth terminal value.
            </p>
            <Formula note="NOPAT = EBIT × (1 − tax rate). Each line is projected as a percentage of revenue.">
              {"FCFFₜ = NOPATₜ + D&Aₜ − CapExₜ − ΔWCₜ"}
            </Formula>
            <Formula note="Equity value = EV − (total debt − cash); value per share = equity ÷ shares outstanding.">
              {"EV = Σₜ₌₁⁵ FCFFₜ ⁄ (1 + WACC)ᵗ  +  TV ⁄ (1 + WACC)⁵\nTV = FCFF₅ × (1 + g) ⁄ (WACC − g)"}
            </Formula>
            <h3>Auto-derived assumptions</h3>
            <DefaultsTable
              rows={[
                ["Revenue growth, Y1", "3-year historical CAGR, capped at 15%, floored at g + 1%", "g + 1% when history is insufficient"],
                ["Growth, Y2–Y5", "Y2 moves 20% of the way to g; Y3–Y5 interpolate linearly; Y5 = g", "—"],
                ["EBIT margin", "3-year average of operating income ÷ revenue", "15%"],
                ["Tax rate", "Income tax ÷ pre-tax income, clamped 0–35%", "21%"],
                ["D&A, CapEx, ΔWC", "3-year average % of revenue; clamped to 0–25%, 0–30%, ±15%", "5%, 4%, 2%"],
                ["Terminal growth (g)", "2.5% long-run nominal growth", "—"],
                ["WACC", "CAPM cost of equity blended with after-tax cost of debt", "9% if market cap is missing"],
              ]}
            />
            <p>
              Sanity checks flag negative or extreme margins, clamped cash-flow ratios, and intrinsic values more than 80%
              below or 150% above the market price. They are informational: the model output is shown exactly as
              computed, with the flag beside it.
            </p>
          </section>

          <section id="ddm">
            <h2>Dividend discount model</h2>
            <Formula note="Rₑ is the CAPM cost of equity. DPS = common dividends paid ÷ shares outstanding.">
              {"P = Σₜ₌₁⁵ DPSₜ ⁄ (1 + Rₑ)ᵗ  +  TV ⁄ (1 + Rₑ)⁵\nTV = DPS₅ × (1 + g) ⁄ (Rₑ − g)"}
            </Formula>
            <DefaultsTable
              rows={[
                ["Dividend growth", "CAGR of common dividends paid over up to five years, capped 0–10%", "2.5%"],
                ["Terminal growth", "min(2%, 0.8 × dividend growth)", "—"],
                ["Cost of equity", "Rf + β × ERP", "10% if unavailable"],
              ]}
            />
            <p>
              Companies with no positive dividend history return no DDM value — the report says so rather than
              showing zero. Growth is measured on total dividends paid, so heavy buybacks can make per-share growth
              differ from the estimate.
            </p>
          </section>

          <section id="reverse-dcf">
            <h2>Reverse DCF</h2>
            <p>
              Holding WACC, terminal growth, margins, reinvestment and share count fixed, a bisection solver finds the
              uniform five-year revenue growth rate at which the DCF value equals the market price (or a price you
              choose), within a search range of −10% to +50%.
            </p>
            <Formula>{"solve g ∈ [−10%, 50%]  such that  DCF(g, g, g, g, g) = price"}</Formula>
            <p>
              The solver status is always shown: <em>above range</em> means the price needs more than 50% growth (read
              the result as a lower bound); <em>below range</em> means the price is justified even at −10%;{" "}
              <em>unstable</em> means negative or erratic cash flows prevent a clean solution.
            </p>
          </section>

          <section id="wacc">
            <h2>Discount rate</h2>
            <Formula note="E = market capitalisation, D = total debt, V = E + D.">
              {"WACC = (E ⁄ V) × Rₑ  +  (D ⁄ V) × R_d × (1 − t)\nRₑ = Rf + β × ERP"}
            </Formula>
            <DefaultsTable
              rows={[
                ["Risk-free rate", "US 10-year Treasury constant-maturity yield; dated in every report", "—"],
                ["Equity risk premium", "Damodaran implied ERP; dated in every report", "—"],
                ["Beta", "Company beta from the provider profile", "1.0 (market) when missing or ≤ 0"],
                ["Pre-tax cost of debt", "|Interest expense| ÷ total debt, clamped 1–15%", "4.5%"],
              ]}
            />
            <p>Market inputs older than six months are flagged as stale in the report.</p>
          </section>

          <section id="multiples">
            <h2>Trading comparables</h2>
            <Formula note="EV-based values subtract net debt before dividing by shares outstanding.">
              {"Implied equity = peer median P/E × net income\nImplied EV     = peer median EV/EBITDA × EBITDA   (or EV/Sales × revenue)\nPer share      = implied equity ⁄ shares"}
            </Formula>
            <p>
              Peers come from the provider&apos;s peer list, keeping companies between 1% and 100× the target&apos;s
              market cap and retaining the five largest; a curated list is used when none qualify, and you can supply
              your own. Multiples are trailing-twelve-month where available, applied to latest fiscal-year metrics.
              Negative or zero multiples are shown as <strong>NM</strong> (not meaningful) and excluded from medians and
              quartiles.
            </p>
          </section>

          <section id="ranges">
            <h2>Ranges and sensitivity</h2>
            <p>
              The football field shows each method as a bar from low to high with the base case marked. The DCF range
              sweeps WACC ±1 point and terminal growth ±0.5 point; peer ranges use the interquartile multiples. A method
              without a valid range is drawn as a point, never as a bar from zero.
            </p>
            <p>
              The sensitivity grid is centred on the company&apos;s own base case — the centre cell always equals the
              headline DCF value — and steps WACC by ±1 and ±2 points and terminal growth by ±0.5 and ±1 point. Cells
              where WACC does not exceed growth are undefined.
            </p>
          </section>

          <section id="data">
            <h2>Data and freshness</h2>
            <p>
              Fundamentals, trailing ratios and peer lists come from Financial Modeling Prep. Quotes and trailing ratios
              are reused for up to one hour, annual statements and peer lists for up to 24 hours. If the provider is
              unavailable, a recent cached copy may be served and the report is labelled accordingly. Prices may be
              delayed.
            </p>
            <p>
              API keys stay on the server. Concurrent requests for the same company share a single provider call, and
              retries are bounded, so the limited data budget goes to real analysis.
            </p>
          </section>

          <section id="limitations" className="doc-limitations">
            <h2>Limitations and model risk</h2>
            <ul>
              <li>Auto-derived assumptions are starting points. A real analysis adjusts growth, margins, reinvestment and discount rate to a business-specific thesis.</li>
              <li>Coverage is limited to US-listed equities on the free data tier; non-US listings are not supported.</li>
              <li>Recent IPOs, distressed issuers and companies with sparse statements can produce unreliable assumptions.</li>
              <li>Peer groups are selected algorithmically and filtered by size; they are not a substitute for curated sector comparables.</li>
              <li>Outputs are educational and not investment advice — one analytical input among many.</li>
            </ul>
          </section>

          <p className="doc-credit">
            Compiled by {AUTHOR.name}. Last revised October 2026. Spotted an error?{" "}
            <a href={AUTHOR.linkedin} target="_blank" rel="noopener noreferrer">Get in touch</a> or{" "}
            <Link href="/#analyze">run a valuation</Link>.
          </p>
        </article>
      </div>
    </div>
  );
}
