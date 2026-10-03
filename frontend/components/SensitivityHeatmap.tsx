import type { SensitivityTable } from "@/types/valuation";
import { formatCurrency, formatPercent, formatRate } from "@/lib/format";

interface SensitivityHeatmapProps {
  data: SensitivityTable;
  currency?: string | null;
}

function heat(value: number | null, price: number | null): string {
  if (value == null || price == null || price <= 0) return "transparent";
  const d = (value - price) / price;
  if (d > 0.2) return "var(--heat-pos-3)";
  if (d > 0.1) return "var(--heat-pos-2)";
  if (d > 0) return "var(--heat-pos-1)";
  if (d > -0.1) return "var(--heat-neg-1)";
  if (d > -0.2) return "var(--heat-neg-2)";
  return "var(--heat-neg-3)";
}

const near = (a: number | undefined, b: number) => a != null && Math.abs(a - b) < 1e-9;

export function SensitivityHeatmap({ data, currency }: SensitivityHeatmapProps) {
  const { wacc_values, terminal_growth_values, grid, current_price } = data;

  return (
    <div className="sensitivity">
      <div className="table-scroll">
        <table className="data-table sensitivity-table">
          <caption className="sr-only">
            Value per share by terminal growth (rows) and WACC (columns); shading compares each value with the
            market price of {formatCurrency(current_price, 2, currency)}.
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="sens-axis">g ↓ · WACC →</span>
              </th>
              {wacc_values.map((w) => (
                <th key={w} scope="col" className={`num${near(data.base_wacc, w) ? " is-base-col" : ""}`}>
                  {formatRate(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {terminal_growth_values.map((g, i) => (
              <tr key={g}>
                <th scope="row" className={`num${near(data.base_terminal_growth, g) ? " is-base-row" : ""}`}>
                  {formatRate(g)}
                </th>
                {wacc_values.map((w, j) => {
                  const v = grid[i]?.[j] ?? null;
                  const isBase = near(data.base_wacc, w) && near(data.base_terminal_growth, g);
                  const delta = v != null && current_price ? (v - current_price) / current_price : null;
                  return (
                    <td
                      key={w}
                      className={`num sens-cell${isBase ? " is-base" : ""}`}
                      style={{ background: heat(v, current_price) }}
                    >
                      <span className="sens-value">{v == null ? "n/a" : formatCurrency(v, 2, currency)}</span>
                      <span className="sens-delta">{delta == null ? "" : formatPercent(delta, 0)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sens-legend" aria-hidden="true">
        <span>Below market</span>
        <i style={{ background: "var(--heat-neg-3)" }} />
        <i style={{ background: "var(--heat-neg-2)" }} />
        <i style={{ background: "var(--heat-neg-1)" }} />
        <i style={{ background: "var(--heat-pos-1)" }} />
        <i style={{ background: "var(--heat-pos-2)" }} />
        <i style={{ background: "var(--heat-pos-3)" }} />
        <span>Above market</span>
        <span className="sens-legend-base">
          <b /> Base case
        </span>
      </div>
      <p className="table-footnote">
        Steps of ±1 percentage point in WACC and ±0.5 point in terminal growth. Cells where WACC ≤ growth are
        undefined (n/a). Each cell shows the change versus the market price.
      </p>
    </div>
  );
}
