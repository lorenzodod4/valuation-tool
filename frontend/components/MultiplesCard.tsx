import type {
  ImpliedValuation,
  MultiplesResult,
  PeerMultiples,
  PeerStatistics,
} from "@/types/valuation";
import { formatCurrency } from "@/lib/format";

interface MultiplesCardProps {
  multiples: MultiplesResult;
}

type RatioKey = keyof PeerStatistics;

const RATIO_LABELS: Record<RatioKey, string> = {
  pe_ratio: "P/E",
  ev_ebitda: "EV/EBITDA",
  ev_sales: "EV/Sales",
  p_book: "P/Book",
};

const RATIO_ORDER: RatioKey[] = ["pe_ratio", "ev_ebitda", "ev_sales", "p_book"];

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
      <div className="implied-card">
        <div className="implied-card-header">
          <span className="implied-card-label">{label}</span>
          <span className="implied-card-multiple">—</span>
        </div>
        <div className="implied-card-value">—</div>
        <div className="implied-card-delta">Insufficient data</div>
      </div>
    );
  }

  const value = data.implied_per_share;
  const hasCurrent =
    currentPrice != null &&
    Number.isFinite(currentPrice) &&
    currentPrice > 0;
  const delta = hasCurrent ? fmtDelta(value, currentPrice) : null;

  return (
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
  );
}

export function MultiplesCard({ multiples }: MultiplesCardProps) {
  const target = multiples.target_metrics;
  const targetSymbol = tickerOf(target);
  const peers = multiples.peer_statistics.peers;
  const stats = multiples.peer_statistics.statistics;
  const currentPrice = multiples.current_price;

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

  return (
    <div>
      {/* Sub-section A: target metrics summary */}
      <div className="multiples-target-grid">
        {RATIO_ORDER.map((key) => (
          <div key={key} className="multiples-target-pill">
            <div className="multiples-target-label">{RATIO_LABELS[key]}</div>
            <div className="multiples-target-value">
              {fmtMultiple(target[key])}
            </div>
            <div className="multiples-target-sub">{targetSymbol}</div>
          </div>
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
          data={multiples.implied_valuations.pe_based}
          currentPrice={currentPrice}
        />
        <ImpliedCard
          label="EV/EBITDA based"
          data={multiples.implied_valuations.ev_ebitda_based}
          currentPrice={currentPrice}
        />
        <ImpliedCard
          label="EV/Sales based"
          data={multiples.implied_valuations.ev_sales_based}
          currentPrice={currentPrice}
        />
      </div>
    </div>
  );
}
