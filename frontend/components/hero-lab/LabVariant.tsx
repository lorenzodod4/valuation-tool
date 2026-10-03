"use client";

import dynamic from "next/dynamic";
import { LabHero } from "@/components/hero-lab/LabHero";
import { ValuationRun } from "@/components/hero-lab/ValuationRun";

const Constellation = dynamic(() => import("@/components/hero-lab/Constellation").then((m) => m.Constellation), { ssr: false });
const Prism = dynamic(() => import("@/components/hero-lab/Prism").then((m) => m.Prism), { ssr: false });

export function LabVariant({ variant }: { variant: "constellation" | "prism" | "run" }) {
  if (variant === "constellation") {
    return (
      <LabHero
        variant={variant}
        layout="split"
        eyebrow="Equity valuation · first pass in seconds"
        title={<>From the whole market <span className="serif-accent">to what one stock is worth.</span></>}
        lede="Type a ticker. Statements, peers and cost of capital become a DCF, a reverse DCF and a football field — every assumption on the page."
        visual={<Constellation />}
        footnote={<span className="lab-hint">Move the cursor through the particles · switch acts below</span>}
      />
    );
  }
  if (variant === "prism") {
    return (
      <LabHero
        variant={variant}
        layout="split"
        eyebrow="Equity valuation · first pass in seconds"
        title={<>One price. <span className="serif-accent">Every way to read it.</span></>}
        lede="DCF, dividend model, reverse DCF and peer multiples — the same company seen through four lenses, with every assumption and caveat in plain sight."
        visual={<Prism />}
      />
    );
  }
  return (
    <LabHero
      variant={variant}
      layout="panel"
      eyebrow="Equity valuation · first pass in seconds"
      title={<>What is a company worth <span className="serif-accent">today?</span></>}
      lede="Watch the model work: cash flow, discounting, terminal value, value per share. Then run it on any US ticker."
      visual={<ValuationRun />}
    />
  );
}
