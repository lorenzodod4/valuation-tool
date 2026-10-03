import type { DCFResult } from "@/types/valuation";
import { ModelWarnings } from "@/components/ModelWarnings";
import { WaccTable } from "@/components/WaccTable";
import { abbreviateNumber, formatCurrency, formatPercent, formatRate, toneOf } from "@/lib/format";

interface DCFCardProps {
  dcf: DCFResult;
  currency?: string | null;
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

export function DCFCard({ dcf, currency }: DCFCardProps) {
  const a = dcf.assumptions_used as AssumptionsShape;
  const wacc = a.wacc ?? null;
  const pvSum = dcf.projections.reduce((s, p) => s + p.pv_fcff, 0);
  const tvShare = dcf.enterprise_value > 0 ? dcf.pv_terminal_value / dcf.enterprise_value : null;
  const negative = dcf.per_share_value != null && dcf.per_share_value <= 0;
  const money = (n: number | null | undefined, d = 2) => abbreviateNumber(n, currency, d);

  const assumptionList: Array<[string, string, string?]> = [
    ["Revenue growth Y1 → Y5", (a.revenue_growth_rates ?? []).map((g) => formatRate(g, 1)).join(" → ") || "—", `3y historical CAGR ${formatRate(a.historical_cagr_3y, 1)}`],
    ["EBIT margin", formatRate(a.ebit_margin, 1), "3-year average"],
    ["Tax rate", formatRate(a.tax_rate, 1), "Effective, clamped 0–35%"],
    ["D&A", formatRate(a.da_pct_revenue, 1), "% of revenue"],
    ["CapEx", formatRate(a.capex_pct_revenue, 1), "% of revenue"],
    ["Δ Working capital", formatRate(a.wc_change_pct_revenue, 1), "% of revenue"],
    ["WACC", formatRate(a.wacc), dcf.wacc_breakdown ? "Derived — see build-up" : "User override"],
    ["Terminal growth", formatRate(a.terminal_growth_rate), "Gordon growth after Y5"],
  ];

  return (
    <div className="model-card">
      <dl className="kpi-row">
        <div className="kpi">
          <dt>Value per share</dt>
          <dd className={`figure${negative ? " tone-neg" : ""}`}>{formatCurrency(dcf.per_share_value, 2, currency)}</dd>
          <span className="kpi-note">
            {negative ? "Negative equity value" : <><span className={`tone-${toneOf(dcf.upside_pct)}`}>{formatPercent(dcf.upside_pct)}</span> vs market</>}
          </span>
        </div>
        <div className="kpi">
          <dt>Enterprise value</dt>
          <dd className="figure">{money(dcf.enterprise_value)}</dd>
          <span className="kpi-note">PV of FCFF + PV of TV</span>
        </div>
        <div className="kpi">
          <dt>Equity value</dt>
          <dd className="figure">{money(dcf.equity_value)}</dd>
          <span className="kpi-note">EV − net debt</span>
        </div>
        <div className="kpi">
          <dt>Terminal value share</dt>
          <dd className={`figure${tvShare != null && tvShare > 0.85 ? " tone-warn" : ""}`}>{formatRate(tvShare, 0)}</dd>
          <span className="kpi-note">{tvShare != null && tvShare > 0.85 ? "High dependence on Y5+" : "of enterprise value"}</span>
        </div>
      </dl>

      <div className="table-scroll">
        <table className="data-table">
          <caption className="sr-only">Five-year free cash flow projection</caption>
          <thead>
            <tr>
              <th scope="col">{currency ?? "USD"}</th>
              {dcf.projections.map((p) => (
                <th key={p.year} scope="col" className="num">Y{p.year}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Revenue</th>
              {dcf.projections.map((p) => <td key={p.year} className="num">{money(p.revenue)}</td>)}
            </tr>
            <tr>
              <th scope="row">Growth</th>
              {dcf.projections.map((p, i) => (
                <td key={p.year} className="num tone-muted">{formatRate(a.revenue_growth_rates?.[i], 1)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">EBIT</th>
              {dcf.projections.map((p) => <td key={p.year} className="num">{money(p.ebit)}</td>)}
            </tr>
            <tr>
              <th scope="row">NOPAT</th>
              {dcf.projections.map((p) => <td key={p.year} className="num">{money(p.nopat)}</td>)}
            </tr>
            <tr>
              <th scope="row">Free cash flow (FCFF)</th>
              {dcf.projections.map((p) => <td key={p.year} className="num">{money(p.fcff)}</td>)}
            </tr>
            <tr>
              <th scope="row">Discount factor</th>
              {dcf.projections.map((p) => (
                <td key={p.year} className="num tone-muted">
                  {wacc != null ? (1 / (1 + wacc) ** p.year).toFixed(3) : "—"}
                </td>
              ))}
            </tr>
            <tr className="row-emphasis">
              <th scope="row">Present value</th>
              {dcf.projections.map((p) => <td key={p.year} className="num">{money(p.pv_fcff)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="model-split">
        <div>
          <h3 className="subhead">From cash flow to value per share</h3>
          <table className="bridge">
            <tbody>
              <tr><th scope="row">Σ PV of FCFF, Y1–Y5</th><td className="num">{money(pvSum)}</td></tr>
              <tr><th scope="row">+ PV of terminal value</th><td className="num">{money(dcf.pv_terminal_value)}</td></tr>
              <tr className="bridge-total"><th scope="row">= Enterprise value</th><td className="num">{money(dcf.enterprise_value)}</td></tr>
              <tr><th scope="row">− Net debt</th><td className="num">{money(dcf.net_debt)}</td></tr>
              <tr className="bridge-total"><th scope="row">= Equity value</th><td className="num">{money(dcf.equity_value)}</td></tr>
              <tr><th scope="row">÷ Shares outstanding</th><td className="num">{dcf.shares_outstanding ? `${(dcf.shares_outstanding / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })}M` : "—"}</td></tr>
              <tr className="bridge-total bridge-final"><th scope="row">= Value per share</th><td className="num">{formatCurrency(dcf.per_share_value, 2, currency)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="subhead">Assumptions</h3>
          <dl className="assumption-list">
            {assumptionList.map(([label, value, note]) => (
              <div key={label}>
                <dt>{label}{note ? <small>{note}</small> : null}</dt>
                <dd className="num">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {dcf.wacc_breakdown ? <WaccTable breakdown={dcf.wacc_breakdown} currency={currency} /> : null}
      <ModelWarnings warnings={dcf.warnings} />
    </div>
  );
}
