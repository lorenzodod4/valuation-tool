/**
 * Financial number formatting. Rules:
 * - Missing or non-finite values render as "—" (never NaN/Infinity/undefined).
 * - Negatives use a true minus sign before the currency: −$12.34.
 * - Currency symbol follows the reported currency; unknown codes are suffixed.
 */

const MINUS = "−";
const EMPTY = "—";

const SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  CAD: "C$",
  AUD: "A$",
  CHF: "CHF ",
  INR: "₹",
};

function isNum(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n);
}

function withCurrency(body: string, negative: boolean, currency: string | null | undefined): string {
  const code = (currency || "USD").toUpperCase();
  const symbol = SYMBOLS[code];
  const sign = negative ? MINUS : "";
  return symbol != null ? `${sign}${symbol}${body}` : `${sign}${body} ${code}`;
}

export function formatCurrency(
  n: number | null | undefined,
  decimals: number = 2,
  currency?: string | null,
): string {
  if (!isNum(n)) return EMPTY;
  const body = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const negative = n < 0 && body.replace(/[0.,]/g, "") !== "";
  return withCurrency(body, negative, currency);
}

/** $1.23T / $456.7B / $12.3M — for large magnitudes. */
export function abbreviateNumber(
  n: number | null | undefined,
  currency?: string | null,
  decimals: number = 2,
): string {
  if (!isNum(n)) return EMPTY;
  const abs = Math.abs(n);
  const units: Array<[number, string]> = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  const unit = units.find(([size]) => abs >= size);
  const body = unit ? `${(abs / unit[0]).toFixed(decimals)}${unit[1]}` : abs.toFixed(decimals);
  return withCurrency(body, n < 0, currency);
}

/** Signed percent for deltas: +12.4% / −3.1%. */
export function formatPercent(n: number | null | undefined, decimals: number = 1): string {
  if (!isNum(n)) return EMPTY;
  const v = n * 100;
  const body = Math.abs(v).toFixed(decimals);
  if (Number(body) === 0) return `${body}%`;
  return `${v > 0 ? "+" : MINUS}${body}%`;
}

/** Unsigned rate for inputs/assumptions: 8.60% (negative keeps a minus sign). */
export function formatRate(n: number | null | undefined, decimals: number = 2): string {
  if (!isNum(n)) return EMPTY;
  const body = Math.abs(n * 100).toFixed(decimals);
  return `${n < 0 && Number(body) !== 0 ? MINUS : ""}${body}%`;
}

/** Valuation multiple. Non-positive multiples are not meaningful ("NM"). */
export function formatMultiple(n: number | null | undefined, decimals: number = 1): string {
  if (!isNum(n)) return EMPTY;
  if (n <= 0) return "NM";
  return `${n.toFixed(decimals)}×`;
}

export function toneOf(n: number | null | undefined): "pos" | "neg" | "muted" {
  if (!isNum(n) || n === 0) return "muted";
  return n > 0 ? "pos" : "neg";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return EMPTY;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}
