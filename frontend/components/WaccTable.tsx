import type { WACCBreakdown } from "@/types/valuation";
import { abbreviateNumber, formatRate } from "@/lib/format";

const DEFAULT_DEBT_PRETAX = 0.045;

function isStale(dataAsOf: string | null | undefined): boolean {
  if (!dataAsOf) return false;
  const t = new Date(dataAsOf).getTime();
  return Number.isFinite(t) && (Date.now() - t) / 86_400_000 > 180;
}

interface WaccTableProps {
  breakdown: WACCBreakdown;
  equityOnly?: boolean;
  currency?: string | null;
}

/** CAPM / WACC build-up with every input sourced. */
export function WaccTable({ breakdown: b, equityOnly = false, currency }: WaccTableProps) {
  const debtDefault = Math.abs(b.cost_of_debt_pretax - DEFAULT_DEBT_PRETAX) < 1e-4;
  const rows: Array<{ label: string; value: string; note?: string; total?: boolean }> = [
    { label: "Risk-free rate", value: formatRate(b.risk_free_rate), note: b.rf_source },
    { label: "Equity risk premium", value: formatRate(b.equity_risk_premium), note: b.erp_source },
    { label: "Beta", value: Number.isFinite(b.beta) ? b.beta.toFixed(2) : "—", note: b.beta_source },
    { label: "Cost of equity (Rₑ = Rf + β × ERP)", value: formatRate(b.cost_of_equity), total: equityOnly },
  ];
  if (!equityOnly) {
    rows.push(
      {
        label: "Pre-tax cost of debt",
        value: formatRate(b.cost_of_debt_pretax),
        note: debtDefault ? "Default — interest expense unavailable" : "Interest expense ÷ total debt",
      },
      { label: "Tax rate", value: formatRate(b.tax_rate), note: "Effective, latest income statement" },
      { label: "After-tax cost of debt", value: formatRate(b.cost_of_debt_aftertax) },
      {
        label: "Weights E / D",
        value: `${formatRate(b.weight_equity, 1)} / ${formatRate(b.weight_debt, 1)}`,
        note: `${abbreviateNumber(b.market_cap, currency, 1)} equity · ${abbreviateNumber(b.total_debt, currency, 1)} debt`,
      },
      { label: "WACC", value: formatRate(b.wacc), total: true },
    );
  }

  return (
    <div className="wacc-table">
      <div className="table-scroll">
        <table className="data-table">
          <caption className="sr-only">{equityOnly ? "Cost of equity build-up" : "WACC build-up"}</caption>
          <thead>
            <tr>
              <th scope="col">{equityOnly ? "Cost of equity" : "Discount rate build-up"}</th>
              <th scope="col" className="num">Value</th>
              <th scope="col">Source / basis</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={r.total ? "row-emphasis" : undefined}>
                <th scope="row" style={{ fontWeight: r.total ? 600 : 450 }}>{r.label}</th>
                <td className="num" style={{ fontWeight: r.total ? 600 : 400 }}>{r.value}</td>
                <td className="tone-muted" style={{ whiteSpace: "normal" }}>{r.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={`table-footnote${isStale(b.data_as_of) ? " tone-warn" : ""}`}>
        {isStale(b.data_as_of)
          ? `Market inputs dated ${b.data_as_of} are more than six months old — verify against current rates.`
          : `Market inputs as of ${b.data_as_of}.`}
      </p>
    </div>
  );
}
