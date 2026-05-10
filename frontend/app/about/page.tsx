import { AUTHOR } from "@/lib/author";

function LinkedInIcon() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.27c-.97 0-1.75-.79-1.75-1.76s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.76-1.75 1.76zm13.5 12.27h-3v-5.6c0-3.37-4-3.11-4 0v5.6h-3v-11h3v1.76c1.4-2.58 7-2.78 7 2.47v6.77z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AboutPage() {
  return (
    <main className="about-page">
      <div className="glow-1" aria-hidden="true" />
      <div className="glow-2" aria-hidden="true" />

      <div className="about-content">
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
          trading multiples, and a football-field summary — all sourced from
          Yahoo Finance, computed in seconds.
        </p>

        <p className="about-body">
          I built it as a personal exercise — partly to sharpen my own modeling
          fundamentals, partly because I wanted a tool that could actually help
          me in the day-to-day work I do as a finance student and intern. The
          mechanical parts of a valuation shouldn&apos;t take longer than the
          thinking behind them.
        </p>

        <p className="about-body">
          The auto-derived assumptions are starting points, not conclusions.
          Free-tier data has gaps, especially outside US large caps. This is an
          educational project, not investment advice. If something looks off,
          it probably is — adjust the inputs to test your own thesis.
        </p>

        <div className="author-signature">
          <span className="author-avatar" aria-hidden="true">
            {initialsOf(AUTHOR.name)}
          </span>
          <div>
            <div className="author-name">{AUTHOR.name}</div>
            <div className="author-role">
              {AUTHOR.role} · building things in finance
            </div>
            <div className="author-links">
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
        </div>

        <div className="about-footnote">
          v0.1.0 · Spring 2026 · Built with Next.js, FastAPI, and yfinance
        </div>
      </div>
    </main>
  );
}
