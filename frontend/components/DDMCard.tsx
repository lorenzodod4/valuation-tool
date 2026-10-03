import type { DDMResult } from "@/types/valuation";
import { ModelWarnings } from "@/components/ModelWarnings";
import { WaccTable } from "@/components/WaccTable";
import { formatCurrency, formatPercent, formatRate, toneOf } from "@/lib/format";

interface DDMCardProps {
  ddm: DDMResult;
  currency?: string | null;
}

interface AssumptionsShape {
  cost_of_equity?: number;
  dividend_growth_rate?: number;
  terminal_growth_rate?: number;
  payout_ratio?: number | null;
}

export function DDMCard({ ddm, currency }: DDMCardProps) {
  const a = ddm.assumptions_used as AssumptionsShape;
  const pvSum = ddm.projections.reduce((s, p) => s + p.pv_dps, 0);
  const money = (n: number | null | undefined) => formatCurrency(n, 2, currency);
  const tvShare =
    ddm.per_share_value && ddm.pv_terminal_value != null ? ddm.pv_terminal_value / ddm.per_share_value : null;

  return (
    <div className="model-card">
      <p className="model-intro">
        Selected automatically for this sector: for banks, insurers and REITs, free cash flow is not a meaningful
        measure of value, so the model discounts the dividends shareholders actually receive.
      </p>
      <dl className="kpi-row">
        <div className="kpi">
          <dt>Value per share</dt>
          <dd className="figure">{money(ddm.per_share_value)}</dd>
          <span className="kpi-note">
            <span className={`tone-${toneOf(ddm.upside_pct)}`}>{formatPercent(ddm.upside_pct)}</span> vs market
          </span>
        </div>
        <div className="kpi">
          <dt>Latest dividend / share</dt>
          <dd className="figure">{money(ddm.latest_dps)}</dd>
          <span className="kpi-note">Common dividends ÷ shares</span>
        </div>
        <div className="kpi">
          <dt>Dividend yield</dt>
          <dd className="figure">{formatRate(ddm.dividend_yield)}</dd>
          <span className="kpi-note">at market price</span>
        </div>
        <div className="kpi">
          <dt>Terminal value share</dt>
          <dd className="figure">{formatRate(tvShare, 0)}</dd>
          <span className="kpi-note">of value per share</span>
        </div>
      </dl>

      {ddm.projections.length > 0 ? (
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">Five-year dividend projection</caption>
            <thead>
              <tr>
                <th scope="col">Per share, {currency ?? "USD"}</th>
                {ddm.projections.map((p) => <th key={p.year} scope="col" className="num">Y{p.year}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Dividend</th>
                {ddm.projections.map((p) => <td key={p.year} className="num">{money(p.dps)}</td>)}
              </tr>
              <tr className="row-emphasis">
                <th scope="row">Present value</th>
                {ddm.projections.map((p) => <td key={p.year} className="num">{money(p.pv_dps)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="model-split">
        <div>
          <h3 className="subhead">From dividends to value per share</h3>
          <table className="bridge">
            <tbody>
              <tr><th scope="row">Σ PV of dividends, Y1–Y5</th><td className="num">{ddm.projections.length ? money(pvSum) : "—"}</td></tr>
              <tr><th scope="row">+ PV of terminal value</th><td className="num">{money(ddm.pv_terminal_value)}</td></tr>
              <tr className="bridge-total bridge-final"><th scope="row">= Value per share</th><td className="num">{money(ddm.per_share_value)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="subhead">Assumptions</h3>
          <dl className="assumption-list">
            <div><dt>Cost of equity<small>CAPM</small></dt><dd className="num">{formatRate(a.cost_of_equity)}</dd></div>
            <div><dt>Dividend growth, Y1–Y5<small>Historical CAGR, capped 0–10%</small></dt><dd className="num">{formatRate(a.dividend_growth_rate)}</dd></div>
            <div><dt>Terminal growth<small>min(2%, 0.8 × dividend growth)</small></dt><dd className="num">{formatRate(a.terminal_growth_rate)}</dd></div>
            <div><dt>Payout ratio<small>Dividends ÷ net income</small></dt><dd className="num">{formatRate(a.payout_ratio ?? null, 1)}</dd></div>
          </dl>
        </div>
      </div>

      {ddm.wacc_breakdown ? <WaccTable breakdown={ddm.wacc_breakdown} equityOnly currency={currency} /> : null}
      <ModelWarnings warnings={ddm.warnings} />
    </div>
  );
}
