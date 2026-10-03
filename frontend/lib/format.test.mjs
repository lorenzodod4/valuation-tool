// Formatting rules for financial numbers. Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { abbreviateNumber, formatCurrency, formatMultiple, formatPercent, formatRate } from "./format.ts";

test("missing and non-finite values never render as NaN/Infinity", () => {
  for (const v of [null, undefined, Number.NaN, Infinity, -Infinity]) {
    assert.equal(formatCurrency(v), "—");
    assert.equal(abbreviateNumber(v), "—");
    assert.equal(formatPercent(v), "—");
    assert.equal(formatRate(v), "—");
    assert.equal(formatMultiple(v), "—");
  }
});

test("negatives use a true minus sign before the currency symbol", () => {
  assert.equal(formatCurrency(-12.345), "−$12.35");
  assert.equal(abbreviateNumber(-2.5e9), "−$2.50B");
  assert.equal(formatPercent(-0.031), "−3.1%");
  assert.equal(formatPercent(0.124), "+12.4%");
});

test("values that round to zero are not signed", () => {
  assert.equal(formatCurrency(-0.001), "$0.00");
  assert.equal(formatPercent(-0.00001), "0.0%");
});

test("non-positive multiples are not meaningful", () => {
  assert.equal(formatMultiple(-18), "NM");
  assert.equal(formatMultiple(0), "NM");
  assert.equal(formatMultiple(24.84), "24.8×");
});

test("currency follows the reported currency", () => {
  assert.equal(formatCurrency(10, 2, "EUR"), "€10.00");
  assert.equal(formatCurrency(10, 2, "SEK"), "10.00 SEK");
  assert.equal(abbreviateNumber(3.2e12, "GBP"), "£3.20T");
});
