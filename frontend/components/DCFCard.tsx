import type { DCFResult } from "@/types/valuation";
import {
  abbreviateNumber,
  formatCurrency,
  formatPercent,
} from "@/lib/format";

interface DCFCardProps {
  dcf: DCFResult;
}

interface AssumptionsShape {
  wacc?: number;
  terminal_growth_rate?: number;
  tax_rate?: number;
  ebit_margin?: number;
  da_pct_revenue?: number;
  capex_pct_revenue?: number;
  wc_change_pct_revenue?: number;
  historical_cagr_3y?: number;
  revenue_growth_rates?: number[];
}

function pct(n: number | null | undefined, decimals: number = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(decimals)}%`;
}

export function DCFCard({ dcf }: DCFCardProps) {
  const assumptions = dcf.assumptions_used as AssumptionsShape;
  const upside = dcf.upside_pct;
  const upsideColor =
    upside == null
      ? "var(--text-primary)"
      : upside >= 0
        ? "var(--bull)"
        : "var(--bear)";

  const y1Growth = assumptions.revenue_growth_rates?.[0];

  const pills: Array<{ label: string; value: string }> = [
    { label: "WACC", value: pct(assumptions.wacc) },
    { label: "Terminal Growth", value: pct(assumptions.terminal_growth_rate) },
    { label: "Tax Rate", value: pct(assumptions.tax_rate) },
    { label: "EBIT Margin", value: pct(assumptions.ebit_margin) },
    { label: "D&A % of Revenue", value: pct(assumptions.da_pct_revenue) },
    { label: "CapEx % of Revenue", value: pct(assumptions.capex_pct_revenue) },
    { label: "Historical CAGR (3y)", value: pct(assumptions.historical_cagr_3y) },
    { label: "Y1 Revenue Growth", value: pct(y1Growth) },
  ];

  return (
    <div>
      <div className="dcf-metrics">
        <div className="dcf-metric">
          <div className="dcf-metric-label">Per Share Value</div>
          <div className="dcf-metric-value">
            {formatCurrency(dcf.per_share_value)}
          </div>
          <div className="dcf-metric-sub">DCF intrinsic</div>
        </div>
        <div className="dcf-metric">
          <div className="dcf-metric-label">Market Price</div>
          <div className="dcf-metric-value">
            {formatCurrency(dcf.current_price)}
          </div>
          <div className="dcf-metric-sub">Current</div>
        </div>
        <div className="dcf-metric">
          <div className="dcf-metric-label">Upside / Downside</div>
          <div className="dcf-metric-value" style={{ color: upsideColor }}>
            {formatPercent(upside)}
          </div>
          <div className="dcf-metric-sub">vs market price</div>
        </div>
        <div className="dcf-metric">
          <div className="dcf-metric-label">Enterprise Value</div>
          <div className="dcf-metric-value">
            {abbreviateNumber(dcf.enterprise_value)}
          </div>
          <div className="dcf-metric-sub">Computed EV</div>
        </div>
      </div>

      <div className="dcf-table-wrap">
        <table className="dcf-projections">
          <thead>
            <tr>
              <th>Year</th>
              <th>Revenue</th>
              <th>EBIT</th>
              <th>NOPAT</th>
              <th>FCFF</th>
              <th>PV(FCFF)</th>
            </tr>
          </thead>
          <tbody>
            {dcf.projections.map((p) => (
              <tr key={p.year}>
                <td>Y{p.year}</td>
                <td>{abbreviateNumber(p.revenue)}</td>
                <td>{abbreviateNumber(p.ebit)}</td>
                <td>{abbreviateNumber(p.nopat)}</td>
                <td>{abbreviateNumber(p.fcff)}</td>
                <td>{abbreviateNumber(p.pv_fcff)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dcf-assumptions">
        <div className="dcf-assumptions-title">Assumptions</div>
        <div className="dcf-assumptions-grid">
          {pills.map((p) => (
            <div key={p.label} className="dcf-pill">
              <div className="dcf-pill-label">{p.label}</div>
              <div className="dcf-pill-value">{p.value}</div>
            </div>
          ))}
        </div>
      </div>

      {dcf.warnings.length > 0 ? (
        <div className="dcf-warnings">
          {dcf.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
