"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";

const DiscountField = dynamic(
  () => import("@/components/hero/DiscountField").then((m) => m.DiscountField),
  { ssr: false },
);

interface HeroVisualProps {
  poster: ReactNode;
}

const REDUCE = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Live scene only when it adds value: with reduced motion or Save-Data the
 * static poster is the complete experience and three.js is never downloaded.
 */
function useLiveScene(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
      return !window.matchMedia(REDUCE).matches && !saveData;
    },
    () => false,
  );
}

export function HeroVisual({ poster }: HeroVisualProps) {
  const rateRef = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);
  const live = useLiveScene();

  return (
    <figure className="hero-visual" data-ready={ready}>
      <div className="hero-visual-stage">
        <div className="hero-visual-poster">{poster}</div>
        {live ? <DiscountField rateLabelRef={rateRef} onReady={() => setReady(true)} /> : null}
      </div>
      <figcaption className="hero-legend">
        <span className="hero-legend-item">
          <i className="legend-swatch legend-swatch-ghost" aria-hidden="true" />
          Projected cash flow
        </span>
        <span className="hero-legend-item">
          <i className="legend-swatch legend-swatch-solid" aria-hidden="true" />
          Worth today
        </span>
        <span className="hero-legend-item hero-legend-rate" title="Illustrative company, base WACC 8.60%">
          Discount rate <span ref={rateRef} className="num">8.60%</span>
        </span>
      </figcaption>
    </figure>
  );
}
