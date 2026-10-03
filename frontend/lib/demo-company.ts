import type { DcfInputs } from "@/lib/dcf-engine";
import { fadeSchedule } from "@/lib/dcf-engine";

/**
 * Illustrative company for the landing-page demo and hero scene.
 * Fictional: no real issuer, no market data, no API request.
 */
export const DEMO_COMPANY = {
  name: "Meridian Instruments",
  ticker: "MRDN",
  sector: "Technology · Scientific instruments",
  currentPrice: 118.0,
  historicalCagr: 0.112,
  defaults: {
    y1Growth: 0.11,
    ebitMargin: 0.22,
    wacc: 0.086,
    terminalGrowth: 0.025,
  },
  base: {
    latestRevenue: 9.8e9,
    taxRate: 0.19,
    daPct: 0.04,
    capexPct: 0.035,
    wcPct: 0.01,
    totalDebt: 4.2e9,
    cash: 3.1e9,
    sharesOutstanding: 340_000_000,
  },
  /** Illustrative peer-implied ranges (per share) for the demo football field. */
  peerRanges: [
    { label: "P/E", low: 96, base: 112, high: 131 },
    { label: "EV/EBITDA", low: 101, base: 119, high: 138 },
    { label: "EV/Sales", low: 84, base: 104, high: 127 },
  ],
} as const;

export interface DemoAssumptions {
  y1Growth: number;
  ebitMargin: number;
  wacc: number;
  terminalGrowth: number;
}

export function demoInputs(a: DemoAssumptions): DcfInputs {
  return {
    ...DEMO_COMPANY.base,
    growthRates: fadeSchedule(a.y1Growth, a.terminalGrowth),
    ebitMargin: a.ebitMargin,
    wacc: a.wacc,
    terminalGrowth: a.terminalGrowth,
  };
}
