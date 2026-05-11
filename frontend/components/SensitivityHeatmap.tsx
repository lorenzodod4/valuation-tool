"use client";

import { Fragment } from "react";
import { formatCurrency } from "@/lib/format";
import type { SectorWarning, SensitivityTable } from "@/types/valuation";

interface SensitivityHeatmapProps {
  data: SensitivityTable;
  sectorWarning?: SectorWarning | null;
}

function getCellColor(
  cellValue: number | null,
  currentPrice: number | null,
): string {
  if (cellValue == null || currentPrice == null || currentPrice <= 0) {
    return "transparent";
  }
  const delta = (cellValue - currentPrice) / currentPrice;
  if (delta > 0.2) return "var(--bull-strong-bg)";
  if (delta > 0.1) return "var(--bull-medium-bg)";
  if (delta > 0) return "var(--bull-soft-bg)";
  if (delta > -0.1) return "var(--bear-soft-bg)";
  if (delta > -0.2) return "var(--bear-medium-bg)";
  return "var(--bear-strong-bg)";
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function SensitivityHeatmap({
  data,
  sectorWarning,
}: SensitivityHeatmapProps) {
  const { wacc_values, terminal_growth_values, grid, current_price } = data;

  return (
    <div className="sensitivity-heatmap">
      {sectorWarning ? (
        <div className="dcf-sector-warning" role="note">
          <span className="dcf-sector-warning-icon" aria-hidden="true">⚠️</span>
          <span>{sectorWarning.message}</span>
        </div>
      ) : null}
      <div className="sensitivity-axis-top">WACC →</div>
      <div className="sensitivity-body">
        <div className="sensitivity-axis-left">↓ Terminal Growth</div>
        <div className="sensitivity-grid-scroll">
          <div className="sensitivity-grid">
            <div className="sensitivity-corner" aria-hidden="true" />
            {wacc_values.map((w) => (
              <div
                key={`wh-${w}`}
                className="sensitivity-cell-header"
              >
                {fmtPct(w)}
              </div>
            ))}
            {terminal_growth_values.map((tg, i) => (
              <Fragment key={`row-${i}`}>
                <div className="sensitivity-cell-header">{fmtPct(tg)}</div>
                {wacc_values.map((_w, j) => {
                  const value = grid[i]?.[j] ?? null;
                  const bg = getCellColor(value, current_price);
                  return (
                    <div
                      key={`${i}-${j}`}
                      className="sensitivity-cell"
                      style={{ backgroundColor: bg }}
                    >
                      <div className="sensitivity-cell-data">
                        {value == null ? "—" : formatCurrency(value)}
                      </div>
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="sensitivity-legend">
        <div className="sensitivity-legend-bar" aria-hidden="true" />
        <div className="sensitivity-legend-labels">
          <span>Below market by 20%+</span>
          <span>Around market</span>
          <span>Above market by 20%+</span>
        </div>
      </div>
    </div>
  );
}
