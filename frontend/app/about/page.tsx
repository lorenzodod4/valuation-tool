import type { Metadata } from "next";
import { GitHubIcon, LinkedInIcon } from "@/components/Icons";
import { AUTHOR } from "@/lib/author";

export const metadata: Metadata = {
  title: "About",
  description: "Why Valuation.io exists, what it is, and what it is not.",
};

const PRINCIPLES = [
  { label: "What it is", text: "A structured first-pass valuation workspace for public equities, designed to expose model assumptions and caveats." },
  { label: "What it is not", text: "A recommendation engine, investment adviser, or replacement for source-data review and judgment." },
  { label: "How to use it", text: "Run the report, read the flags, compare methods, then challenge the automated assumptions before drawing conclusions." },
];

function initialsOf(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default function AboutPage() {
  return (
    <div className="container doc about">
      <header className="doc-header">
        <p className="eyebrow">About</p>
        <h1 className="doc-title">
          The mechanical parts of a valuation <span className="serif-accent">shouldn&apos;t take longer than the thinking.</span>
        </h1>
      </header>

      <div className="about-grid">
        <div className="about-copy">
          <p>
            Valuation.io is a self-serve equity research toolkit. Type any US-listed ticker and get a discounted cash
            flow model, comparable trading multiples and a football-field summary, sourced from Financial Modeling Prep
            and computed in seconds.
          </p>
          <p>
            I built it as a personal exercise to sharpen my own modelling fundamentals, and to have a tool that helps
            with the day-to-day work of finance.
          </p>
          <p>
            The auto-derived assumptions are starting points, not conclusions. Free-tier data has gaps, especially
            outside US large caps. This is an educational project, not investment advice.
          </p>
        </div>

        <aside className="author-card panel">
          <span className="author-avatar" aria-hidden="true">{initialsOf(AUTHOR.name)}</span>
          <div>
            <strong>{AUTHOR.name}</strong>
            <p className="tone-muted">{AUTHOR.role} · building things in finance</p>
          </div>
          <div className="author-links">
            <a href={AUTHOR.linkedin} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
              <LinkedInIcon /> LinkedIn
            </a>
            <a href={AUTHOR.github} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
              <GitHubIcon /> GitHub
            </a>
          </div>
        </aside>
      </div>

      <ul className="principles">
        {PRINCIPLES.map((p) => (
          <li key={p.label}>
            <p className="eyebrow">{p.label}</p>
            <p>{p.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
