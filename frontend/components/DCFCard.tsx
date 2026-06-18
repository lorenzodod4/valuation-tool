import type { DCFResult, WACCBreakdown } from "@/types/valuation";
import { TriangleAlert } from "lucide-react";
import { BorderGlow } from "@/components/BorderGlow";
import {
  abbreviateNumber,
  formatCurrency,
  formatPercent,
} from "@/lib/format";

const DEFAULT_DEBT_PRETAX = 0.045;

function pctFmt(n: number | null | undefined, decimals: number = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(decimals)}%`;
}

function isWaccDataStale(dataAsOf: string | undefined | null): boolean {
  if (!dataAsOf) return false;
  const asOf = new Date(dataAsOf);
  if (Number.isNaN(asOf.getTime())) return false;
  const days = (Date.now() - asOf.getTime()) / (1000 * 60 * 60 * 24);
  return days > 180;
}

interface WaccRow {
  label: string;
  value: string;
  note?: string;
  highlight?: boolean;
  final?: boolean;
}

function WaccBreakdownView({ breakdown }: { breakdown: WACCBreakdown }) {
  const stale = isWaccDataStale(breakdown.data_as_of);
  // Heuristic: when the configured default surfaces, treat as a fallback.
  const debtPretaxIsDefault =
    Math.abs(breakdown.cost_of_debt_pretax - DEFAULT_DEBT_PRETAX) < 0.0001;

  const rows: WaccRow[] = [
    {
      label: "Risk-free rate",
      value: pctFmt(breakdown.risk_free_rate),
      note: breakdown.rf_source,
    },
    {
      label: "Equity risk premium",
      value: pctFmt(breakdown.equity_risk_premium),
      note: breakdown.erp_source,
    },
    {
      label: "Beta (β)",
      value: breakdown.beta.toFixed(3),
      note: breakdown.beta_source,
    },
    {
      label: "Cost of equity (Re)",
      value: pctFmt(breakdown.cost_of_equity),
      note: "Rf + β × ERP",
      highlight: true,
    },
    {
      label: "Cost of debt pretax",
      value: pctFmt(breakdown.cost_of_debt_pretax),
      note: debtPretaxIsDefault ? "default fallback" : "derived from financials",
    },
    {
      label: "Tax rate",
      value: pctFmt(breakdown.tax_rate),
      note: "from latest income statement",
    },
    {
      label: "Cost of debt after-tax (Rd × (1−t))",
      value: pctFmt(breakdown.cost_of_debt_aftertax),
      highlight: true,
    },
    {
      label: "Equity weight (E/V)",
      value: pctFmt(breakdown.weight_equity, 1),
    },
    {
      label: "Debt weight (D/V)",
      value: pctFmt(breakdown.weight_debt, 1),
    },
    {
      label: "WACC",
      value: pctFmt(breakdown.wacc),
      final: true,
    },
  ];

  return (
    <div className="wacc-breakdown-section">
      <div className="wacc-breakdown-title-row">
        <h4 className="wacc-breakdown-title">WACC Breakdown</h4>
        <span className="wacc-breakdown-source">
          Model reference inputs · {breakdown.data_as_of}
        </span>
      </div>

      <div className="wacc-rows">
        {rows.map((row) => {
          const cls = row.final
            ? "wacc-row wacc-row-final"
            : row.highlight
              ? "wacc-row wacc-row-highlight"
              : "wacc-row";
          return (
            <div key={row.label} className={cls}>
              <div className="wacc-row-label">{row.label}</div>
              <div className="wacc-row-value">{row.value}</div>
              <div className="wacc-row-note">{row.note ?? ""}</div>
            </div>
          );
        })}
      </div>

      {stale ? (
        <div className="wacc-stale-warning">
          WACC inputs may be stale (last updated {breakdown.data_as_of}).
          Consider refreshing manually.
        </div>
      ) : (
        <div className="wacc-footnote">Inputs as of {breakdown.data_as_of}</div>
      )}
    </div>
  );
}

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

  // Terminal Value Exposure: Critical metric for institutional model risk.
  const tvExposure =
    dcf.enterprise_value !== 0
      ? dcf.pv_terminal_value / dcf.enterprise_value
      : null;
  const exposureTone =
    tvExposure == null
      ? "var(--text-secondary)"
      : tvExposure > 0.85
        ? "var(--bear)"
        : tvExposure > 0.70
          ? "var(--amber)"
          : "var(--text-secondary)";

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
      {dcf.sector_warning ? (
        <div className="dcf-sector-warning" role="note">
          <TriangleAlert
            className="dcf-sector-warning-icon"
            size={16}
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <span>{dcf.sector_warning.message}</span>
        </div>
      ) : null}
      <div className="dcf-metrics">
        <BorderGlow className="report-glow-card kpi-glow" fillOpacity={0.1} glowRadius={18}>
          <div className="dcf-metric">
            <div className="dcf-metric-label">Per Share Value</div>
            <div className="dcf-metric-value">
              {formatCurrency(dcf.per_share_value)}
            </div>
            <div className="dcf-metric-sub">DCF intrinsic</div>
          </div>
        </BorderGlow>
        <BorderGlow className="report-glow-card kpi-glow" fillOpacity={0.1} glowRadius={18}>
          <div className="dcf-metric">
            <div className="dcf-metric-label">Market Price</div>
            <div className="dcf-metric-value">
              {formatCurrency(dcf.current_price)}
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
            <div className="dcf-metric-label">Enterprise Value</div>
            <div className="dcf-metric-value">
              {abbreviateNumber(dcf.enterprise_value)}
            </div>
            <div className="dcf-metric-sub">Computed EV</div>
          </div>
        </BorderGlow>
        <BorderGlow className="report-glow-card kpi-glow" fillOpacity={0.1} glowRadius={18}>
          <div className="dcf-metric">
            <div className="dcf-metric-label">TV Exposure</div>
            <div className="dcf-metric-value" style={{ color: exposureTone }}>{pct(tvExposure, 1)}</div>
            <div className="dcf-metric-sub">% of total EV</div>
          </div>
        </BorderGlow>
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
            <BorderGlow key={p.label} className="report-glow-card assumption-pill-glow" fillOpacity={0.1} glowRadius={14}>
              <div className="dcf-pill">
                <div className="dcf-pill-label">{p.label}</div>
                <div className="dcf-pill-value">{p.value}</div>
              </div>
            </BorderGlow>
          ))}
        </div>
      </div>

      {dcf.wacc_breakdown ? (
        <WaccBreakdownView breakdown={dcf.wacc_breakdown} />
      ) : null}

      {dcf.warnings.length > 0 ? (
        <BorderGlow className="report-glow-card warning-glow" fillOpacity={0.1}>
          <div className="dcf-warnings">
            {dcf.warnings.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
        </BorderGlow>
      ) : null}
    </div>
  );
}
