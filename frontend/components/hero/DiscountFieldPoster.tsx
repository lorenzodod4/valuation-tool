import { BASE_WACC, fieldColumns } from "@/components/hero/discountFieldModel";

/**
 * Static, server-rendered drawing of the same Discount Field: shown instantly,
 * kept when WebGL is unavailable, and faded out once the live scene is ready.
 */
export function DiscountFieldPoster() {
  const columns = fieldColumns(BASE_WACC);
  const S = 58; // px per scene unit
  const W = 640;
  const H = 440;
  const depth = { x: 16, y: -10 };
  const plate = 6;
  const gap = 2.4;

  return (
    <svg
      className="discount-field-poster"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Five years of projected free cash flow drawn as columns: the outline is the nominal amount, the solid stack is its present value, shrinking further out in time. A taller terminal-value column stands behind them."
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id="poster-dots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="var(--ink-4)" opacity="0.5" />
        </pattern>
        <linearGradient id="poster-floor-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.2" />
        </linearGradient>
        <mask id="poster-floor-mask">
          <rect x="0" y="230" width={W} height={H - 230} fill="url(#poster-floor-fade)" />
        </mask>
      </defs>
      <rect x="0" y="230" width={W} height={H - 230} fill="url(#poster-dots)" mask="url(#poster-floor-mask)" />
      {columns.map((c, i) => {
        const step = i + (c.isTerminal ? 0.55 : 0);
        const x = 70 + step * 78;
        const base = 372 - step * 26;
        const w = 34;
        const nominalH = c.nominal * S;
        const presentH = Math.max(0, c.present) * S;
        const plates = Math.floor(presentH / (plate + gap));
        const fill = c.isTerminal ? "var(--ink-3)" : "var(--signal)";
        return (
          <g key={c.label}>
            {/* nominal ghost: front face + top + side */}
            <path
              d={`M${x} ${base} V${base - nominalH} H${x + w} V${base} Z M${x} ${base - nominalH} l${depth.x} ${depth.y} h${w} l${-depth.x} ${-depth.y} M${x + w} ${base - nominalH} l${depth.x} ${depth.y} V${base + depth.y} l${-depth.x} ${-depth.y}`}
              fill="none"
              stroke="var(--ink-3)"
              strokeOpacity="0.55"
              strokeWidth="1"
            />
            {Array.from({ length: plates }, (_, k) => {
              const y = base - (k + 1) * (plate + gap) + gap;
              return (
                <g key={k}>
                  <rect x={x + 2} y={y} width={w - 4} height={plate} rx="1" fill={fill} opacity={0.92} />
                  <path
                    d={`M${x + w - 2} ${y} l${depth.x - 3} ${depth.y + 2} v${plate} l${-(depth.x - 3)} ${-(depth.y + 2)} Z`}
                    fill={fill}
                    opacity={0.5}
                  />
                </g>
              );
            })}
            <text
              x={x + w / 2}
              y={base + 22}
              textAnchor="middle"
              className="poster-label"
            >
              {c.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
