import { formatCurrency } from "@/lib/format";

export interface RangeRow {
  label: string;
  sublabel?: string;
  base: number | null;
  low: number | null;
  high: number | null;
  /** Primary model gets the signal hue; peer methods stay neutral. */
  emphasis?: boolean;
}

interface RangeChartProps {
  rows: RangeRow[];
  marker?: { value: number; label: string } | null;
  /** Formats a value; `decimals` adapts to the price scale (2 below $100). */
  format?: (n: number, decimals: number) => string;
  caption?: string;
}

function finite(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n);
}

function niceStep(span: number, targetTicks: number): number {
  const raw = span / Math.max(1, targetTicks);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / pow;
  const nice = unit < 1.5 ? 1 : unit < 3 ? 2 : unit < 7 ? 5 : 10;
  return nice * pow;
}

/**
 * Football-field style range chart. Rows show [low, high] as a bar with the
 * base value as a tick; a row with no valid range is a point marker (never a
 * bar from zero, which would falsely imply a range). Supports negative values.
 */
export function RangeChart({ rows, marker, format: formatRaw = (n, d) => formatCurrency(n, d), caption }: RangeChartProps) {
  const hasRows = rows.some((r) => finite(r.base));
  if (!hasRows) {
    return <p className="range-empty">No valuation method produced a value for this company — see the notices above.</p>;
  }
  const values: number[] = [];
  for (const r of rows) {
    for (const v of [r.base, r.low, r.high]) if (finite(v)) values.push(v);
  }
  if (marker && finite(marker.value)) values.push(marker.value);

  if (values.length === 0) {
    return <p className="range-empty">No implied per-share values are available.</p>;
  }

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= Math.abs(min) * 0.2 || 1;
    max += Math.abs(max) * 0.2 || 1;
  }
  const pad = (max - min) * 0.08;
  min -= pad;
  max += pad;
  // A football field is a range chart: a zero baseline is not required, but
  // when values straddle zero the zero line must be visible.
  const step = niceStep(max - min, 4);
  const magnitude = Math.max(...values.map((v) => Math.abs(v)));
  const valueDecimals = magnitude < 100 ? 2 : 0;
  const tickDecimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  const format = (n: number) => formatRaw(n, valueDecimals);
  const formatTick = (n: number) => formatRaw(n, tickDecimals);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  // Rounded so server- and client-rendered style strings are identical.
  const pct = (v: number) => Math.round(((v - lo) / (hi - lo)) * 100000) / 1000;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Number(t.toPrecision(12)));

  const summary = rows
    .map((r) => {
      if (!finite(r.base)) return `${r.label}: unavailable`;
      const range = finite(r.low) && finite(r.high) && r.high > r.low ? `, range ${format(r.low)} to ${format(r.high)}` : "";
      return `${r.label}: ${format(r.base)}${range}`;
    })
    .join("; ");

  return (
    <figure className="range-chart">
      <div className="sr-only">
        {caption ? `${caption}. ` : ""}
        {summary}.{marker ? ` ${marker.label}: ${format(marker.value)}.` : ""}
      </div>
      <div className="range-grid" aria-hidden="true">
        <div className="range-head">
          <span />
          <span />
          <span className="range-head-values">
            <span>Low</span>
            <span>Base</span>
            <span>High</span>
          </span>
        </div>
        {rows.map((r) => {
          const hasRange = finite(r.low) && finite(r.high) && r.high > r.low;
          return (
            <div key={r.label} className={`range-row${r.emphasis ? " is-emphasis" : ""}`}>
              <span className="range-label">
                {r.label}
                {r.sublabel ? <small>{r.sublabel}</small> : null}
              </span>
              <span className="range-track">
                {ticks.map((t) => (
                  <i key={t} className="range-gridline" style={{ left: `${pct(t)}%` }} />
                ))}
                {lo < 0 && hi > 0 ? <i className="range-zero" style={{ left: `${pct(0)}%` }} /> : null}
                {marker && finite(marker.value) ? (
                  <i className="range-price" style={{ left: `${pct(marker.value)}%` }} />
                ) : null}
                {hasRange ? (
                  <i
                    className="range-bar"
                    style={{ left: `${pct(r.low as number)}%`, width: `${Math.round((pct(r.high as number) - pct(r.low as number)) * 1000) / 1000}%` }}
                  />
                ) : null}
                {finite(r.base) ? (
                  <i
                    className={hasRange ? "range-base" : "range-point"}
                    style={{ left: `${pct(r.base)}%` }}
                  />
                ) : null}
              </span>
              <span className="range-values num">
                <span>{hasRange ? format(r.low as number) : "—"}</span>
                <span className="range-values-base">{finite(r.base) ? format(r.base) : "n/a"}</span>
                <span>{hasRange ? format(r.high as number) : "—"}</span>
              </span>
            </div>
          );
        })}
        <div className="range-axis">
          <span />
          <span className="range-axis-track">
            {ticks.map((t, i) => (
              <span key={t} className={`range-tick num${i === ticks.length - 1 ? " is-last" : ""}`} style={{ left: `${pct(t)}%` }}>
                {formatTick(t)}
              </span>
            ))}
            {marker && finite(marker.value) ? (
              <span className="range-marker" style={{ left: `${pct(marker.value)}%` }}>
                <span className="range-marker-label">
                  {marker.label} <b className="num">{format(marker.value)}</b>
                </span>
              </span>
            ) : null}
          </span>
          <span />
        </div>
      </div>
      <dl className="range-mobile-values" aria-hidden="true">
        {rows.map((r) => {
          const hasRange = finite(r.low) && finite(r.high) && r.high > r.low;
          return (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd className="num">
                <b>{finite(r.base) ? format(r.base) : "n/a"}</b>
                {hasRange ? ` · ${format(r.low as number)} – ${format(r.high as number)}` : ""}
              </dd>
            </div>
          );
        })}
      </dl>
    </figure>
  );
}
