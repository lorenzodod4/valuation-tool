"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore, type ReactNode } from "react";

const Constellation = dynamic(
  () => import("@/components/hero/Constellation").then((m) => m.Constellation),
  { ssr: false },
);

const REDUCE = "(prefers-reduced-motion: reduce)";
let webgl: boolean | null = null;

function hasWebGL(): boolean {
  if (webgl === null) {
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
  }
  return webgl;
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** "pending" during SSR/hydration, then "live" or "static" on the client. */
function useSceneMode(): "pending" | "live" | "static" {
  return useSyncExternalStore(
    subscribe,
    () => {
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
      return !window.matchMedia(REDUCE).matches && !saveData && hasWebGL() ? "live" : "static";
    },
    () => "pending",
  );
}

export function HeroScene({ poster }: { poster: ReactNode }) {
  const mode = useSceneMode();
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const live = mode === "live" && state !== "failed";

  return (
    <div className="hero-scene" data-mode={live ? "live" : mode === "pending" ? "pending" : "static"} data-ready={state === "ready"}>
      <div className="hero-poster">{poster}</div>
      {live ? <Constellation onReady={() => setState("ready")} onFail={() => setState("failed")} /> : null}
      <p className="sr-only">
        Illustration: thousands of points form a sphere — the market — then fall into one stock&apos;s price chart,
        and finally regroup into valuation ranges by method, set against the market price.
      </p>
    </div>
  );
}
