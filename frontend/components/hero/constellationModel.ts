/**
 * Shared geometry for the homepage entrance (live scene and static poster).
 * World units; the football-field rows are illustrative, not a real company.
 */
export const ACTS = ["Market", "Price", "Value"] as const;

export const ROWS = [
  { label: "DCF", y: 1.05, lo: -1.35, hi: 0.35 },
  { label: "P/E", y: 0.35, lo: -0.75, hi: 0.95 },
  { label: "EV/EBITDA", y: -0.35, lo: -0.6, hi: 1.55 },
  { label: "EV/Sales", y: -1.05, lo: -1.0, hi: 1.35 },
];

export const PRICE_X = 0.25;
export const CHART_W = 3.2;
