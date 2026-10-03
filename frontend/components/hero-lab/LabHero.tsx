import type { ReactNode } from "react";
import { SearchBar } from "@/components/SearchBar";

interface LabHeroProps {
  variant: string;
  layout: "split" | "panel";
  eyebrow: string;
  title: ReactNode;
  lede: string;
  visual: ReactNode;
  footnote?: ReactNode;
}

/** Shared frame so the entrance concepts are compared on equal terms. */
export function LabHero({ variant, layout, eyebrow, title, lede, visual, footnote }: LabHeroProps) {
  return (
    <section className={`lab-hero lab-hero-${layout}`} data-variant={variant} aria-labelledby="lab-title">
      {layout === "split" ? <div className="lab-hero-visual">{visual}</div> : null}
      <div className="lab-hero-veil" aria-hidden="true" />
      <div className="container lab-hero-inner">
        <div className="lab-hero-copy">
          <p className="eyebrow fade-up" style={{ ["--i" as string]: 0 }}>
            <span className="eyebrow-dot" aria-hidden="true" />
            {eyebrow}
          </p>
          <h1 id="lab-title" className="lab-hero-title fade-up" style={{ ["--i" as string]: 1 }}>
            {title}
          </h1>
          <p className="lede fade-up" style={{ ["--i" as string]: 2 }}>{lede}</p>
          <div className="lab-hero-search fade-up" style={{ ["--i" as string]: 3 }}>
            <SearchBar />
          </div>
        </div>
        {layout === "panel" ? (
          <div className="lab-hero-panel fade-up" style={{ ["--i" as string]: 2 }}>{visual}</div>
        ) : null}
        {footnote ? <div className="lab-hero-footnote fade-up" style={{ ["--i" as string]: 4 }}>{footnote}</div> : null}
      </div>
    </section>
  );
}
