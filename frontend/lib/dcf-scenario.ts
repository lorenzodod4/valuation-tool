/**
 * Rebuilds the engine inputs of a report's DCF from what the server returned,
 * so the client what-if starts from exactly the server's base case.
 */
import type { DCFResult } from "@/types/valuation";
import type { DcfInputs } from "./dcf-engine";

interface Assumptions {
  wacc?: number;
  terminal_growth_rate?: number;
  tax_rate?: number;
  ebit_margin?: number;
  da_pct_revenue?: number;
  capex_pct_revenue?: number;
  wc_change_pct_revenue?: number;
  revenue_growth_rates?: number[];
}

export type Key = "wacc" | "tg" | "y1" | "margin";
export type Levers = Record<Key, number>;

export function baseInputs(dcf: DCFResult): { inputs: DcfInputs; levers: Levers } | null {
  const a = dcf.assumptions_used as Assumptions;
  const g = a.revenue_growth_rates;
  const first = dcf.projections[0];
  if (
    a.wacc == null || a.terminal_growth_rate == null || a.ebit_margin == null || a.tax_rate == null ||
    a.da_pct_revenue == null || a.capex_pct_revenue == null || a.wc_change_pct_revenue == null ||
    !g || g.length !== 5 || !first || !(dcf.shares_outstanding && dcf.shares_outstanding > 0) ||
    !(1 + g[0] > 0)
  ) {
    return null;
  }
  const inputs: DcfInputs = {
    latestRevenue: first.revenue / (1 + g[0]),
    growthRates: [g[0], g[1], g[2], g[3], g[4]],
    ebitMargin: a.ebit_margin,
    taxRate: a.tax_rate,
    daPct: a.da_pct_revenue,
    capexPct: a.capex_pct_revenue,
    wcPct: a.wc_change_pct_revenue,
    wacc: a.wacc,
    terminalGrowth: a.terminal_growth_rate,
    // Only net debt enters the bridge.
    totalDebt: dcf.net_debt,
    cash: 0,
    sharesOutstanding: dcf.shares_outstanding,
  };
  return {
    inputs,
    // Exact server values, so the untouched scenario reproduces the report.
    levers: { wacc: a.wacc, tg: a.terminal_growth_rate, y1: g[0], margin: a.ebit_margin },
  };
}

