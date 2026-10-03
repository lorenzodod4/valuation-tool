"use client";

import { type FormEvent, useId, useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import type { ImpliedValuation, MultiplesResult, PeerMultiples, PeerStatistics } from "@/types/valuation";
import { getMultiples } from "@/lib/api";
import { abbreviateNumber, formatCurrency, formatMultiple, formatPercent, toneOf } from "@/lib/format";
import { ModelWarnings } from "@/components/ModelWarnings";

interface MultiplesCardProps {
  multiples: MultiplesResult;
  onPeersChange?: (multiples: MultiplesResult) => void;
  currency?: string | null;
}

type RatioKey = keyof PeerStatistics;
const RATIOS: Array<{ key: RatioKey; label: string }> = [
  { key: "pe_ratio", label: "P/E" },
  { key: "ev_ebitda", label: "EV/EBITDA" },
  { key: "ev_sales", label: "EV/Sales" },
  { key: "p_book", label: "P/Book" },
];
const PEER_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,9}$/;
const MAX_PEERS = 8;
const SOURCE_LABEL: Record<string, string> = {
  custom: "Custom peer set",
  fmp_stock_peers: "Provider peer list, size-filtered",
  static_fallback: "Curated fallback list",
};

const symbolOf = (r: PeerMultiples) => r.symbol ?? r.ticker;

function Implied({ label, data, price, currency }: { label: string; data: ImpliedValuation | null; price: number | null; currency?: string | null }) {
  const v = data?.implied_per_share ?? null;
  const delta = v != null && v > 0 && price ? (v - price) / price : null;
  return (
    <div className="implied">
      <span className="implied-label">{label}</span>
      <strong className={`figure${v != null && v <= 0 ? " tone-neg" : ""}`}>{formatCurrency(v, 2, currency)}</strong>
      <span className="implied-note">
        {v == null ? (
          "Insufficient data or non-positive metric"
        ) : v <= 0 ? (
          "Net debt exceeds implied EV — not meaningful"
        ) : (
          <>
            <span className={`num tone-${toneOf(delta)}`}>{formatPercent(delta)}</span> vs market ·{" "}
            {formatMultiple(data?.multiple_used)} median
          </>
        )}
      </span>
      {data?.implied_per_share_low != null && data?.implied_per_share_high != null ? (
        <span className="implied-range num">
          {formatCurrency(data.implied_per_share_low, 0, currency)} – {formatCurrency(data.implied_per_share_high, 0, currency)} interquartile
        </span>
      ) : null}
    </div>
  );
}

export function MultiplesCard({ multiples, onPeersChange, currency }: MultiplesCardProps) {
  const inputId = useId();
  const [original] = useState(multiples);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = multiples.target_metrics;
  const targetSymbol = symbolOf(target);
  const stats = multiples.peer_statistics.statistics;
  const peers = [...multiples.peer_statistics.peers]
    .filter((p) => symbolOf(p) !== targetSymbol)
    .sort((a, b) => (b.market_cap ?? -Infinity) - (a.market_cap ?? -Infinity));
  const isCustom = multiples.peer_source === "custom";
  const skipped = multiples.peer_statistics.skipped_peers ?? [];

  async function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const tickers = Array.from(
      new Set(input.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter((s) => s && s !== targetSymbol)),
    );
    if (tickers.length === 0) return setError("Enter at least one peer ticker other than the company itself.");
    if (tickers.length > MAX_PEERS) return setError(`Use at most ${MAX_PEERS} peers.`);
    const invalid = tickers.filter((t) => !PEER_PATTERN.test(t));
    if (invalid.length) return setError(`Invalid ticker format: ${invalid.slice(0, 3).join(", ")}`);
    setError(null);
    setLoading(true);
    try {
      onPeersChange?.(await getMultiples(targetSymbol, tickers));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load peer data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="model-card">
      <div className="implied-grid">
        <Implied label="P/E based" data={multiples.implied_valuations.pe_based} price={multiples.current_price} currency={currency} />
        <Implied label="EV/EBITDA based" data={multiples.implied_valuations.ev_ebitda_based} price={multiples.current_price} currency={currency} />
        <Implied label="EV/Sales based" data={multiples.implied_valuations.ev_sales_based} price={multiples.current_price} currency={currency} />
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <caption className="sr-only">Trading multiples: company versus peers</caption>
          <thead>
            <tr>
              <th scope="col">Company</th>
              <th scope="col" className="num">Market cap</th>
              {RATIOS.map((r) => <th key={r.key} scope="col" className="num">{r.label}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="row-emphasis">
              <th scope="row">
                <span className="mono">{targetSymbol}</span> <span className="badge badge-signal">Company</span>
                <span className="cell-sub truncate" style={{ maxWidth: 260 }} title={target.name ?? undefined}>{target.name ?? ""}</span>
              </th>
              <td className="num">{abbreviateNumber(target.market_cap, currency, 1)}</td>
              {RATIOS.map((r) => <td key={r.key} className="num">{formatMultiple(target[r.key])}</td>)}
            </tr>
            {peers.map((p) => (
              <tr key={symbolOf(p)}>
                <th scope="row">
                  <span className="mono">{symbolOf(p)}</span>
                  <span className="cell-sub truncate" style={{ maxWidth: 260 }} title={p.name ?? undefined}>{p.name ?? ""}</span>
                </th>
                <td className="num">{abbreviateNumber(p.market_cap, currency, 1)}</td>
                {RATIOS.map((r) => <td key={r.key} className="num">{formatMultiple(p[r.key])}</td>)}
              </tr>
            ))}
            {peers.length === 0 ? (
              <tr>
                <td colSpan={2 + RATIOS.length} className="tone-muted">No usable peers were found for this company.</td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Peer median</th>
              <td />
              {RATIOS.map((r) => (
                <td key={r.key} className="num">
                  {formatMultiple(stats[r.key].median)}
                  <span className="cell-sub">n = {stats[r.key].count}</span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="table-footnote">
        {SOURCE_LABEL[multiples.peer_source ?? ""] ?? "Peer set"}. NM = not meaningful (negative or zero multiple,
        excluded from medians). {multiples.period_basis ? `${multiples.period_basis}.` : ""}
      </p>

      <details className="peer-override" open={isCustom}>
        <summary>
          <SlidersHorizontal size={14} strokeWidth={1.8} aria-hidden="true" />
          {isCustom ? "Custom peers active" : "Choose your own peers"}
        </summary>
        <form className="inline-form" onSubmit={apply}>
          <div className="field">
            <label className="field-label" htmlFor={inputId}>Peer tickers, comma separated (max {MAX_PEERS})</label>
            <input
              id={inputId}
              className="input mono"
              value={input}
              placeholder="e.g. MSFT, GOOGL, ORCL"
              onChange={(e) => {
                setInput(e.target.value.toUpperCase());
                if (error) setError(null);
              }}
              disabled={loading}
              aria-invalid={Boolean(error)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Loading peers…" : "Apply"}
          </button>
          {isCustom ? (
            <button type="button" className="btn btn-ghost" disabled={loading} onClick={() => { setInput(""); onPeersChange?.(original); }}>
              <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" /> Default peers
            </button>
          ) : null}
        </form>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <p className="table-footnote">Each new peer uses market-data requests; results are cached for repeat use.</p>
      </details>

      <ModelWarnings
        title="Comparables flags"
        warnings={[
          ...(multiples.warnings ?? []),
          ...skipped.map((s) => `${s.symbol} skipped: ${s.reason}`),
        ].filter((w, i, all) => all.indexOf(w) === i)}
      />
    </div>
  );
}
