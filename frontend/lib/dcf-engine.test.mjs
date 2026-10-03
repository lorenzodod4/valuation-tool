// Parity test: the demo's TypeScript DCF must match the backend Python engine.
// Run with: npm test   (Node's built-in runner + type stripping; no extra deps)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fadeSchedule, runDcf } from "./dcf-engine.ts";

const { cases } = JSON.parse(
  readFileSync(new URL("./__fixtures__/dcf-parity.json", import.meta.url), "utf8"),
);

const close = (actual, expected, label) => {
  const tolerance = Math.max(1e-9, Math.abs(expected) * 1e-12);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
};

for (const [i, { inputs: c, expected }] of cases.entries()) {
  test(`matches Python run_dcf — case ${i + 1}`, () => {
    const out = runDcf({
      latestRevenue: c.latestRevenue,
      growthRates: fadeSchedule(c.y1, c.tg),
      ebitMargin: c.ebitMargin,
      taxRate: c.taxRate,
      daPct: c.daPct,
      capexPct: c.capexPct,
      wcPct: c.wcPct,
      wacc: c.wacc,
      terminalGrowth: c.tg,
      totalDebt: c.totalDebt,
      cash: c.cash,
      sharesOutstanding: c.shares,
    });
    assert.equal(out.ok, true);
    close(out.enterpriseValue, expected.enterpriseValue, "EV");
    close(out.equityValue, expected.equityValue, "equity");
    close(out.perShare, expected.perShare, "per share");
    close(out.pvTerminalValue, expected.pvTerminalValue, "PV(TV)");
    out.projections.forEach((p, k) => close(p.fcff, expected.fcff[k], `FCFF Y${k + 1}`));
  });
}

test("rejects WACC at or below terminal growth instead of returning Infinity", () => {
  const out = runDcf({
    latestRevenue: 1e9, growthRates: fadeSchedule(0.1, 0.03), ebitMargin: 0.2, taxRate: 0.2,
    daPct: 0.03, capexPct: 0.03, wcPct: 0, wacc: 0.03, terminalGrowth: 0.03,
    totalDebt: 0, cash: 0, sharesOutstanding: 1e6,
  });
  assert.equal(out.ok, false);
});

test("rejects non-positive revenue and shares", () => {
  const base = {
    latestRevenue: 1e9, growthRates: fadeSchedule(0.1, 0.02), ebitMargin: 0.2, taxRate: 0.2,
    daPct: 0.03, capexPct: 0.03, wcPct: 0, wacc: 0.09, terminalGrowth: 0.02,
    totalDebt: 0, cash: 0, sharesOutstanding: 1e6,
  };
  assert.equal(runDcf({ ...base, latestRevenue: 0 }).ok, false);
  assert.equal(runDcf({ ...base, sharesOutstanding: 0 }).ok, false);
  assert.equal(runDcf({ ...base, wacc: Number.NaN }).ok, false);
});
