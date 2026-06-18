"use client";

import { useState, type FormEvent } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import type {
  ImpliedValuation,
  MultiplesResult,
  PeerMultiples,
  PeerStatistics,
} from "@/types/valuation";
import { BorderGlow } from "@/components/BorderGlow";
import { formatCurrency } from "@/lib/format";
import { getMultiples } from "@/lib/api";

interface MultiplesCardProps {
  multiples: MultiplesResult;
  onPeersChange?: (multiples: MultiplesResult) => void;
}

type RatioKey = keyof PeerStatistics;

const RATIO_LABELS: Record<RatioKey, string> = {
  pe_ratio: "P/E",
  ev_ebitda: "EV/EBITDA",
  ev_sales: "EV/Sales",
  p_book: "P/Book",
};

const RATIO_ORDER: RatioKey[] = ["pe_ratio", "ev_ebitda", "ev_sales", "p_book"];
const CUSTOM_PEER_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,9}$/;
const MAX_CUSTOM_PEERS = 8;

function fmtMultiple(n: number | null | undefined, decimals: number = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(decimals)}x`;
}

function fmtDelta(value: number, current: number): {
  text: string;
  positive: boolean;
} {
  const delta = (value - current) / current;
  const positive = delta >= 0;
  return {
    text: `${positive ? "+" : ""}${(delta * 100).toFixed(1)}%`,
    positive,
  };
}

function tickerOf(row: PeerMultiples): string {
  return row.symbol ?? row.ticker;
}

interface ImpliedCardProps {
  label: string;
  data: ImpliedValuation | null | undefined;
  currentPrice: number | null;
}

function ImpliedCard({ label, data, currentPrice }: ImpliedCardProps) {
  if (
    !data ||
    data.implied_per_share == null ||
    !Number.isFinite(data.implied_per_share)
  ) {
    return (
      <BorderGlow className="report-glow-card implied-glow" fillOpacity={0.08} glowRadius={18}>
        <div className="implied-card">
          <div className="implied-card-header">
            <span className="implied-card-label">{label}</span>
            <span className="implied-card-multiple">—</span>
          </div>
          <div className="implied-card-value">—</div>
          <div className="implied-card-delta">Insufficient data</div>
        </div>
      </BorderGlow>
    );
  }

  const value = data.implied_per_share;
  const hasCurrent =
    currentPrice != null &&
    Number.isFinite(currentPrice) &&
    currentPrice > 0;
  const delta = hasCurrent ? fmtDelta(value, currentPrice) : null;

  return (
    <BorderGlow className="report-glow-card implied-glow" fillOpacity={0.08} glowRadius={18}>
      <div className="implied-card">
        <div className="implied-card-header">
          <span className="implied-card-label">{label}</span>
          <span className="implied-card-multiple">
            {fmtMultiple(data.multiple_used)} median
          </span>
        </div>
        <div className="implied-card-value">{formatCurrency(value)}</div>
        {hasCurrent && delta ? (
          <div className="implied-card-delta">
            vs current {formatCurrency(currentPrice)}{" "}
            <span
              className={
                delta.positive ? "delta-positive" : "delta-negative"
              }
            >
              {delta.text}
            </span>
          </div>
        ) : (
          <div className="implied-card-delta">No current price</div>
        )}
      </div>
    </BorderGlow>
  );
}

export function MultiplesCard({ multiples, onPeersChange }: MultiplesCardProps) {
  const target = multiples.target_metrics;
  const targetSymbol = tickerOf(target);

  // Local state for custom peer override
  const [overridePeers, setOverridePeers] = useState<MultiplesResult | null>(null);
  const [peerInput, setPeerInput] = useState("");
  const [peerLoading, setPeerLoading] = useState(false);
  const [peerError, setPeerError] = useState<string | null>(null);

  const activeData = overridePeers ?? multiples;
  const currentPrice = activeData.current_price;
  const peers = activeData.peer_statistics.peers;
  const stats = activeData.peer_statistics.statistics;
  const peerSource = activeData.peer_source ?? "provider/default";

  const sortedPeers = [...peers].sort((a, b) => {
    const aCap = a.market_cap ?? -Infinity;
    const bCap = b.market_cap ?? -Infinity;
    return bCap - aCap;
  });

  const tableRows: Array<{ row: PeerMultiples; isTarget: boolean }> = [
    { row: target, isTarget: true },
    ...sortedPeers
      .filter((p) => tickerOf(p) !== targetSymbol)
      .map((row) => ({ row, isTarget: false })),
  ];

  async function handlePeerOverride(e: FormEvent) {
    e.preventDefault();
    const tickers = Array.from(
      new Set(
        peerInput
          .split(/[,\s]+/)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
          .filter((s) => s !== targetSymbol),
      ),
    );
    if (tickers.length === 0) {
      setPeerError("Enter at least one peer ticker different from the target.");
      return;
    }
    if (tickers.length > MAX_CUSTOM_PEERS) {
      setPeerError(`Use at most ${MAX_CUSTOM_PEERS} custom peers.`);
      return;
    }
    const invalid = tickers.filter((ticker) => !CUSTOM_PEER_PATTERN.test(ticker));
    if (invalid.length > 0) {
      setPeerError(`Invalid ticker format: ${invalid.slice(0, 3).join(", ")}`);
      return;
    }

    setPeerLoading(true);
    setPeerError(null);
    try {
      const result = await getMultiples(targetSymbol, tickers);
      setOverridePeers(result);
      onPeersChange?.(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch peer data";
      setPeerError(msg);
    } finally {
      setPeerLoading(false);
    }
  }

  return (
    <div>
      {/* Custom peer override */}
      <div className="multiples-peer-override">
        <details className="multiples-peer-details">
          <summary className="multiples-peer-summary">
            <span className="multiples-peer-summary-text">
              <SlidersHorizontal size={14} strokeWidth={1.8} aria-hidden="true" />
              {overridePeers ? "Custom peers active" : "Override peers"}
            </span>
            <span className="multiples-peer-summary-hint">
              {peerSource.replace(/_/g, " ")}
            </span>
          </summary>
          <form onSubmit={handlePeerOverride} className="multiples-peer-form">
            <input
              type="text"
              value={peerInput}
              onChange={(e) => setPeerInput(e.target.value)}
              placeholder="e.g. MSFT, GOOGL, ORCL"
              className="multiples-peer-input"
              disabled={peerLoading}
              aria-label="Custom peer tickers"
            />
            <button
              type="submit"
              className="multiples-peer-btn"
              disabled={peerLoading}
            >
              {peerLoading ? "Loading…" : "Apply"}
            </button>
            {overridePeers ? (
              <button
                type="button"
                className="multiples-peer-btn multiples-peer-btn-reset"
                onClick={() => {
                  setOverridePeers(null);
                  setPeerInput("");
                  setPeerError(null);
                }}
              >
                <RotateCcw size={13} strokeWidth={1.8} aria-hidden="true" />
                Reset
              </button>
            ) : null}
          </form>
          {peerError ? (
            <p className="multiples-peer-error">{peerError}</p>
          ) : null}
        </details>
      </div>
      {activeData.warnings && activeData.warnings.length > 0 ? (
        <div className="multiples-warnings" role="note">
          {activeData.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}
      {/* Sub-section A: target metrics summary */}
      <div className="multiples-target-grid">
        {RATIO_ORDER.map((key) => (
          <BorderGlow key={key} className="report-glow-card multiple-kpi-glow" fillOpacity={0.07} glowRadius={16}>
            <div className="multiples-target-pill">
              <div className="multiples-target-label">{RATIO_LABELS[key]}</div>
              <div className="multiples-target-value">
                {fmtMultiple(target[key])}
              </div>
              <div className="multiples-target-sub">{targetSymbol}</div>
            </div>
          </BorderGlow>
        ))}
      </div>

      {/* Sub-section B: peer comparison table */}
      <div className="multiples-section-header">
        <span className="multiples-section-title">Peer comparison</span>
        <span className="multiples-section-subtitle">
          {peers.length} peer{peers.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="peer-table-wrap">
        <table className="peer-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Company</th>
              <th className="num">P/E</th>
              <th className="num">EV/EBITDA</th>
              <th className="num">EV/Sales</th>
              <th className="num">P/Book</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map(({ row, isTarget }) => {
              const symbol = tickerOf(row);
              return (
                <tr
                  key={symbol}
                  className={isTarget ? "peer-row-target" : undefined}
                >
                  <td>
                    {symbol}
                    {isTarget ? (
                      <span className="peer-target-badge">TARGET</span>
                    ) : null}
                  </td>
                  <td className="peer-company">{row.name ?? "—"}</td>
                  <td className="num">{fmtMultiple(row.pe_ratio)}</td>
                  <td className="num">{fmtMultiple(row.ev_ebitda)}</td>
                  <td className="num">{fmtMultiple(row.ev_sales)}</td>
                  <td className="num">{fmtMultiple(row.p_book)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="peer-stats-row">
              <td colSpan={2}>
                <span className="peer-stats-label">Median</span>
              </td>
              {RATIO_ORDER.map((key) => (
                <td key={key} className="num">
                  <span className="peer-stats-prefix">median:</span>{" "}
                  {fmtMultiple(stats[key].median)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Sub-section C: implied valuations */}
      <div className="multiples-section-header" style={{ marginTop: 32 }}>
        <span className="multiples-section-title">Implied valuations</span>
        <span className="multiples-section-subtitle">
          Peer median × {targetSymbol} metrics
        </span>
      </div>

      <div className="implied-grid">
        <ImpliedCard
          label="P/E based"
          data={activeData.implied_valuations.pe_based}
          currentPrice={currentPrice}
        />
        <ImpliedCard
          label="EV/EBITDA based"
          data={activeData.implied_valuations.ev_ebitda_based}
          currentPrice={currentPrice}
        />
        <ImpliedCard
          label="EV/Sales based"
          data={activeData.implied_valuations.ev_sales_based}
          currentPrice={currentPrice}
        />
      </div>
    </div>
  );
}
