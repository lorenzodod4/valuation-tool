import type { DDMResult } from "@/types/valuation";
import { BorderGlow } from "@/components/BorderGlow";
import {
  formatCurrency,
  formatPercent,
} from "@/lib/format";

function pct(n: number | null | undefined, decimals: number = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(decimals)}%`;
}

interface DDMCardProps {
  ddm: DDMResult;
}

interface AssumptionsShape {
  cost_of_equity?: number;
  dividend_growth_rate?: number;
  terminal_growth_rate?: number;
  payout_ratio?: number;
}

export function DDMCard({ ddm }: DDMCardProps) {
  const assumptions = ddm.assumptions_used as AssumptionsShape;
  const upside = ddm.upside_pct;
  const upsideColor =
    upside == null
      ? "var(--text-primary)"
      : upside >= 0
        ? "var(--bull)"
        : "var(--bear)";

  const pills: Array<{ label: string; value: string }> = [
    { label: "Cost of Equity (Re)", value: pct(assumptions.cost_of_equity) },
    { label: "Dividend Growth", value: pct(assumptions.dividend_growth_rate) },
    { label: "Terminal Growth", value: pct(assumptions.terminal_growth_rate) },
    { label: "Payout Ratio", value: pct(assumptions.payout_ratio) },
  ];

  return (
    <div>
      <div className="ddm-method-note">
        Dividend Discount Model (DDM) is the standard valuation methodology for
        financial institutions, REITs, and dividend-focused equities. This model
        values the company based on projected dividends rather than free cash flow.
      </div>

      <div className="dcf-metrics">
        <BorderGlow className="report-glow-card kpi-glow" fillOpacity={0.1} glowRadius={18}>
          <div className="dcf-metric">
            <div className="dcf-metric-label">Per Share Value</div>
            <div className="dcf-metric-value">
              {formatCurrency(ddm.per_share_value)}
            </div>
            <div className="dcf-metric-sub">DDM intrinsic</div>
          </div>
        </BorderGlow>
        <BorderGlow className="report-glow-card kpi-glow" fillOpacity={0.1} glowRadius={18}>
          <div className="dcf-metric">
            <div className="dcf-metric-label">Market Price</div>
            <div className="dcf-metric-value">
              {formatCurrency(ddm.current_price)}
            </div>
            <div className="dcf-metric-sub">Current</div>
          </div>
        </BorderGlow>
        <BorderGlow className="report-glow-card kpi-glow" fillOpacity={0.1} glowRadius={18}>
          <div className="dcf-metric">
            <div className="dcf-metric-label">Upside / Downside</div>
            <div className="dcf-metric-value" style={{ color: upsideColor }}>
              {formatPercent(upside)}
            </div>
            <div className="dcf-metric-sub">vs market price</div>
          </div>
        </BorderGlow>
        <BorderGlow className="report-glow-card kpi-glow" fillOpacity={0.1} glowRadius={18}>
          <div className="dcf-metric">
            <div className="dcf-metric-label">Dividend Yield</div>
            <div className="dcf-metric-value">
              {pct(ddm.dividend_yield)}
            </div>
            <div className="dcf-metric-sub">Current yield</div>
          </div>
        </BorderGlow>
        <BorderGlow className="report-glow-card kpi-glow" fillOpacity={0.1} glowRadius={18}>
          <div className="dcf-metric">
            <div className="dcf-metric-label">Latest DPS</div>
            <div className="dcf-metric-value">
              {formatCurrency(ddm.latest_dps)}
            </div>
            <div className="dcf-metric-sub">Annual dividend</div>
          </div>
        </BorderGlow>
      </div>

      {ddm.projections.length > 0 ? (
        <div className="dcf-table-wrap">
          <table className="dcf-projections">
            <thead>
              <tr>
                <th>Year</th>
                <th>DPS</th>
                <th>PV(DPS)</th>
              </tr>
            </thead>
            <tbody>
              {ddm.projections.map((p) => (
                <tr key={p.year}>
                  <td>Y{p.year}</td>
                  <td>{formatCurrency(p.dps)}</td>
                  <td>{formatCurrency(p.pv_dps)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="dcf-assumptions">
        <div className="dcf-assumptions-title">Assumptions</div>
        <div className="dcf-assumptions-grid">
          {pills.map((p) => (
            <BorderGlow key={p.label} className="report-glow-card assumption-pill-glow" fillOpacity={0.1} glowRadius={14}>
              <div className="dcf-pill">
                <div className="dcf-pill-label">{p.label}</div>
                <div className="dcf-pill-value">{p.value}</div>
              </div>
            </BorderGlow>
          ))}
        </div>
      </div>

      {ddm.wacc_breakdown ? (
        <div className="wacc-breakdown-section">
          <div className="wacc-breakdown-title-row">
            <h4 className="wacc-breakdown-title">Cost of Equity Breakdown</h4>
            <span className="wacc-breakdown-source">
              CAPM model · {ddm.wacc_breakdown.data_as_of}
            </span>
          </div>
          <div className="wacc-rows">
            <div className="wacc-row">
              <div className="wacc-row-label">Risk-free rate</div>
              <div className="wacc-row-value">{pct(ddm.wacc_breakdown.risk_free_rate)}</div>
              <div className="wacc-row-note">{ddm.wacc_breakdown.rf_source}</div>
            </div>
            <div className="wacc-row">
              <div className="wacc-row-label">Equity risk premium</div>
              <div className="wacc-row-value">{pct(ddm.wacc_breakdown.equity_risk_premium)}</div>
              <div className="wacc-row-note">{ddm.wacc_breakdown.erp_source}</div>
            </div>
            <div className="wacc-row">
              <div className="wacc-row-label">Beta (β)</div>
              <div className="wacc-row-value">{ddm.wacc_breakdown.beta.toFixed(3)}</div>
              <div className="wacc-row-note">{ddm.wacc_breakdown.beta_source}</div>
            </div>
            <div className="wacc-row wacc-row-final">
              <div className="wacc-row-label">Cost of Equity (Re)</div>
              <div className="wacc-row-value">{pct(ddm.wacc_breakdown.cost_of_equity)}</div>
              <div className="wacc-row-note">Rf + β × ERP</div>
            </div>
          </div>
        </div>
      ) : null}

      {ddm.warnings.length > 0 ? (
        <BorderGlow className="report-glow-card warning-glow" fillOpacity={0.1}>
          <div className="dcf-warnings">
            {ddm.warnings.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
        </BorderGlow>
      ) : null}
    </div>
  );
}
