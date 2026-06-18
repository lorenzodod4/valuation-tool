import Link from "next/link";
import { BorderGlow } from "@/components/BorderGlow";
import { FeatureCards } from "@/components/FeatureCards";
import { LandingHero } from "@/components/LandingHero";
import { ScrollFade } from "@/components/ScrollFade";
import { SearchBar } from "@/components/SearchBar";
import { AUTHOR } from "@/lib/author";

const WORKFLOW_STEPS = [
  {
    num: "01",
    title: "Data collection",
    detail: "Pull public company statements, market data, peers, and profile context from available provider responses.",
  },
  {
    num: "02",
    title: "Validation",
    detail: "Surface missing data, sector caveats, stale inputs, and sanity checks before the report is interpreted.",
  },
  {
    num: "03",
    title: "Valuation",
    detail: "Run DCF, WACC, trading comparables, sensitivity, and football-field framing without changing source assumptions silently.",
  },
  {
    num: "04",
    title: "Report",
    detail: "Package the output into a readable dashboard with warnings, methodology notes, and PDF-ready structure.",
  },
];

const FEATURE_POINTS = [
  "Discounted cash flow",
  "Reverse DCF context",
  "Peer multiples",
  "WACC transparency",
  "Valuation ranges",
  "Sanity checks",
  "PDF report",
];

export default function HomePage() {
  return (
    <main className="page-root landing-page">
      <div className="glow-1" aria-hidden="true" />
      <div className="glow-2" aria-hidden="true" />

      {/* Hero — stays visible for much longer scroll distance */}
      <ScrollFade fadeZone={0.2} drift={true} startFadeAfterScroll={1400}>
        <LandingHero />
      </ScrollFade>

      <div className="landing-content">
        {/* Workflow section */}
        <ScrollFade fadeZone={0.2} drift={true}>
          <section className="landing-section" aria-labelledby="workflow-title">
            <div className="landing-section-header">
              <span className="section-kicker">OPERATING MODEL</span>
              <h2 id="workflow-title">From ticker to report, in a controlled sequence.</h2>
              <p>
                The product narrative is intentionally report-first: collect the
                data, validate the inputs, calculate the valuation, and expose
                the caveats.
              </p>
            </div>
            <div className="workflow-grid">
              {WORKFLOW_STEPS.map((step) => (
                <article key={step.num} className="workflow-card">
                  <span>{step.num}</span>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                </article>
              ))}
            </div>
          </section>
        </ScrollFade>

        {/* Features section */}
        <ScrollFade fadeZone={0.2} drift={true}>
          <section className="landing-section" aria-labelledby="features-title">
            <div className="landing-section-header split">
              <div>
                <span className="section-kicker">ANALYST TOOLKIT</span>
                <h2 id="features-title">Core valuation modules without decorative noise.</h2>
              </div>
              <p>
                Each module is designed to support review, not hide uncertainty
                behind a single score.
              </p>
            </div>
            <FeatureCards useBorderGlow />
            <div className="feature-strip" aria-label="Available valuation capabilities">
              {FEATURE_POINTS.map((point) => (
                <span key={point}>{point}</span>
              ))}
            </div>
          </section>
        </ScrollFade>

        {/* Trust section */}
        <ScrollFade fadeZone={0.2} drift={true}>
          <section className="landing-section trust-section" aria-labelledby="trust-title">
            <div>
              <span className="section-kicker">TRUST POSITIONING</span>
              <h2 id="trust-title">Transparent enough to audit. Restrained enough for finance.</h2>
            </div>
            <div className="trust-grid">
              <p>
                The app uses publicly available provider data and presents
                assumptions, caveats, stale inputs, and sector limitations in the
                frontend report.
              </p>
              <p>
                It is an educational valuation tool, not investment advice. A
                serious analyst should still verify source data, adjust
                assumptions, and evaluate qualitative risk.
              </p>
            </div>
            <BorderGlow className="home-glow-card methodology-glow">
              <Link href="/methodology" className="methodology-link-card">
                <span>Read methodology</span>
                <strong>Review DCF, WACC, multiples, ranges, limitations, and data sources.</strong>
              </Link>
            </BorderGlow>
          </section>
        </ScrollFade>

        {/* CTA section */}
        <ScrollFade fadeZone={0.2} drift={false}>
          <BorderGlow className="home-glow-card cta-glow">
            <section className="landing-cta">
              <span className="section-kicker">START ANALYSIS</span>
              <h2>Run the first pass, then challenge the assumptions.</h2>
              <div className="cta-search">
                <SearchBar />
              </div>
            </section>
          </BorderGlow>
        </ScrollFade>
      </div>

      <div className="footer-bar landing-footer">
        <span>DATA · FINANCIAL MODELING PREP · DELAYED WHERE APPLICABLE</span>
        <Link href="/about" className="footer-credit">
          BUILT BY {AUTHOR.name.toUpperCase()}
        </Link>
        <span>EDUCATIONAL USE ONLY · NOT INVESTMENT ADVICE</span>
      </div>
    </main>
  );
}