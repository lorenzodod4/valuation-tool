// The report's what-if must start from exactly the server's DCF base case.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fadeSchedule, runDcf } from "./dcf-engine.ts";
import { baseInputs } from "./dcf-scenario.ts";

const { cases } = JSON.parse(
  readFileSync(new URL("./__fixtures__/dcf-parity.json", import.meta.url), "utf8"),
);

for (const [i, { inputs: c, expected }] of cases.entries()) {
  test(`what-if base reproduces the server value — case ${i + 1}`, () => {
    const growth = fadeSchedule(c.y1, c.tg);
    const server = runDcf({
      latestRevenue: c.latestRevenue, growthRates: growth, ebitMargin: c.ebitMargin, taxRate: c.taxRate,
      daPct: c.daPct, capexPct: c.capexPct, wcPct: c.wcPct, wacc: c.wacc, terminalGrowth: c.tg,
      totalDebt: c.totalDebt, cash: c.cash, sharesOutstanding: c.shares,
    });
    if (!server.ok) return;
    // Shape of the API's DCFResult, as the report receives it.
    const dcf = {
      projections: server.projections.map((p) => ({ year: p.year, revenue: p.revenue, ebit: p.ebit, nopat: p.nopat, fcff: p.fcff, pv_fcff: p.pvFcff })),
      net_debt: c.totalDebt - c.cash,
      shares_outstanding: c.shares,
      per_share_value: expected.perShare,
      assumptions_used: {
        wacc: c.wacc, terminal_growth_rate: c.tg, tax_rate: c.taxRate, ebit_margin: c.ebitMargin,
        da_pct_revenue: c.daPct, capex_pct_revenue: c.capexPct, wc_change_pct_revenue: c.wcPct,
        revenue_growth_rates: growth,
      },
    };
    const base = baseInputs(dcf);
    assert.ok(base);
    const out = runDcf(base.inputs);
    assert.ok(out.ok);
    assert.ok(Math.abs(out.perShare - expected.perShare) <= Math.abs(expected.perShare) * 1e-9, `${out.perShare} vs ${expected.perShare}`);
  });
}

test("returns null when assumptions are incomplete", () => {
  assert.equal(baseInputs({ projections: [], net_debt: 0, shares_outstanding: 1, assumptions_used: {} }), null);
});
