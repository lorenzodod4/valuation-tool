import { BorderGlow } from "@/components/BorderGlow";
import { GitHubIcon, LinkedInIcon } from "@/components/Icons";
import { AUTHOR } from "@/lib/author";

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const ABOUT_HIGHLIGHTS = [
  {
    label: "Scope",
    value: "US-listed equities",
    detail: "Built for cleaner coverage, tighter assumptions, and faster review.",
  },
  {
    label: "Methods",
    value: "DCF, multiples, ranges",
    detail: "The core outputs stay visible instead of being collapsed into one score.",
  },
  {
    label: "Tone",
    value: "Report-first",
    detail: "The interface favors auditability, notes, and practical decision support.",
  },
];

const ABOUT_BRIEFING = [
  {
    label: "What it is",
    text: "A structured first-pass valuation workspace for public equities, designed to expose model assumptions and caveats.",
  },
  {
    label: "What it is not",
    text: "A recommendation engine, investment adviser, or replacement for source-data review and judgment.",
  },
  {
    label: "How to use it",
    text: "Run the report, inspect warnings, compare methods, then challenge the automated assumptions before drawing conclusions.",
  },
];

export default function AboutPage() {
  return (
    <main className="about-page">
      <div className="glow-1" aria-hidden="true" />
      <div className="glow-2" aria-hidden="true" />

      <div className="about-content">
        <div className="about-hero">
          <div className="about-hero-copy">
            <div className="kicker">
              <span className="kicker-line" aria-hidden="true" />
              <span className="kicker-text">ABOUT · VALUATION.IO</span>
              <span className="kicker-line" aria-hidden="true" />
            </div>

            <h1 className="about-title">
              An <span className="about-gradient">open</span> valuation toolkit.
            </h1>

            <p className="about-body">
              Valuation.io is a self-serve equity research toolkit. Type any
              US-listed ticker, get a discounted cash flow model, comparable
              trading multiples, and a football-field summary, all sourced from
              Financial Modeling Prep and computed in seconds.
            </p>

            <p className="about-body">
              I built it as a personal exercise to sharpen my own modeling
              fundamentals and to have a tool that helps in the day-to-day work
              of finance. The mechanical parts of a valuation should not take
              longer than the thinking behind them.
            </p>

            <p className="about-body">
              The auto-derived assumptions are starting points, not conclusions.
              Free-tier data has gaps, especially outside US large caps. This is
              an educational project, not investment advice.
            </p>
          </div>

          <div className="about-bento" aria-label="About highlights">
            {ABOUT_HIGHLIGHTS.map((item) => (
              <BorderGlow
                key={item.label}
                className="home-glow-card about-highlight-glow"
              >
                <div className="about-highlight-card">
                  <span className="about-highlight-label">{item.label}</span>
                  <strong className="about-highlight-value">{item.value}</strong>
                  <p className="about-highlight-detail">{item.detail}</p>
                </div>
              </BorderGlow>
            ))}

            <BorderGlow
              className="home-glow-card about-signature-glow"
            >
              <div className="about-signature-card">
                <div className="author-signature">
                  <span className="author-avatar" aria-hidden="true">
                    {initialsOf(AUTHOR.name)}
                  </span>
                  <div>
                    <div className="author-name">{AUTHOR.name}</div>
                    <div className="author-role">
                      {AUTHOR.role} · building things in finance
                    </div>
                  </div>
                </div>

                <div className="about-signature-links">
                  <a
                    href={AUTHOR.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="author-link"
                  >
                    <LinkedInIcon />
                    LinkedIn
                  </a>
                  <a
                    href={AUTHOR.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="author-link"
                  >
                    <GitHubIcon />
                    GitHub
                  </a>
                </div>
              </div>
            </BorderGlow>
          </div>
        </div>

        <section className="about-briefing" aria-labelledby="about-briefing-title">
          <div>
            <span className="section-kicker">OPERATING PRINCIPLES</span>
            <h2 id="about-briefing-title">Built to keep the model auditable.</h2>
          </div>
          <div className="about-briefing-grid">
            {ABOUT_BRIEFING.map((item) => (
              <article key={item.label} className="about-briefing-item">
                <span>{item.label}</span>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="credibility-strip" aria-label="Professional links">
          <div className="credibility-track">
            <div className="credibility-sequence">
              <a href={AUTHOR.linkedin} target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
              <a href={AUTHOR.github} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
              <a href="https://escp.eu/" target="_blank" rel="noopener noreferrer">
                ESCP
              </a>
              <span>Finance student</span>
              <span>Valuation toolkit</span>
            </div>
          </div>
        </div>

        <div className="about-footnote">
          v0.2.1 · June 2026 · Built with Next.js, FastAPI, and Financial Modeling Prep
        </div>
      </div>
    </main>
  );
}
