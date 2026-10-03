"use client";

import { useState } from "react";
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
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);
  const hv = hover ? grid[hover.i]?.[hover.j] ?? null : null;
  const baseI = terminal_growth_values.findIndex((g) => near(data.base_terminal_growth, g));
  const baseJ = wacc_values.findIndex((w) => near(data.base_wacc, w));
  const baseV = baseI >= 0 && baseJ >= 0 ? grid[baseI]?.[baseJ] ?? null : null;

  return (
    <div className="sensitivity">
      <p className="sens-readout" aria-hidden="true" data-on={hover != null}>
        {hover ? (
          <>
            <span>WACC <b className="num">{formatRate(wacc_values[hover.j])}</b></span>
            <span>g <b className="num">{formatRate(terminal_growth_values[hover.i])}</b></span>
            <span className="sens-readout-value">
              → <b className="num">{hv == null ? "n/a" : formatCurrency(hv, 2, currency)}</b>
            </span>
            {hv != null && baseV != null && baseV > 0 ? (
              <span className="num">{formatPercent(hv / baseV - 1, 1)} vs base</span>
            ) : null}
          </>
        ) : (
          <span>Hover a cell to read it against the base case</span>
        )}
      </p>
      <div className="table-scroll" onMouseLeave={() => setHover(null)}>
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
                <th key={w} scope="col" className={`num${near(data.base_wacc, w) ? " is-base-col" : ""}${hover?.j === wacc_values.indexOf(w) ? " is-hover" : ""}`}>
                  {formatRate(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {terminal_growth_values.map((g, i) => (
              <tr key={g}>
                <th scope="row" className={`num${near(data.base_terminal_growth, g) ? " is-base-row" : ""}${hover?.i === i ? " is-hover" : ""}`}>
                  {formatRate(g)}
                </th>
                {wacc_values.map((w, j) => {
                  const v = grid[i]?.[j] ?? null;
                  const isBase = near(data.base_wacc, w) && near(data.base_terminal_growth, g);
                  const delta = v != null && current_price ? (v - current_price) / current_price : null;
                  return (
                    <td
                      key={w}
                      className={`num sens-cell${isBase ? " is-base" : ""}${hover && (hover.i === i || hover.j === j) ? " is-cross" : ""}${hover?.i === i && hover.j === j ? " is-hover" : ""}`}
                      style={{ background: heat(v, current_price) }}
                      onMouseEnter={() => setHover({ i, j })}
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
