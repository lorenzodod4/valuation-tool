import { PRICE_X, ROWS } from "@/components/hero/constellationModel";

/**
 * Static final act of the entrance (valuation ranges against the market price),
 * drawn as dots. Server-rendered: shown without JavaScript, with reduced motion,
 * Save-Data, or no WebGL — three.js is never downloaded in those cases.
 */
const W = 520;
const H = 400;
const S = 112; // px per world unit
const X0 = W / 2 - 0.1 * S;
const px = (x: number) => Math.round((X0 + x * S) * 10) / 10;
const py = (y: number) => Math.round((H / 2 - y * S) * 10) / 10;

function dots() {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return ROWS.map((row) => {
    const n = Math.round((row.hi - row.lo) * 46);
    return Array.from({ length: n }, () => ({
      x: px(row.lo + (row.hi - row.lo) * rnd()),
      y: py(row.y + (rnd() - 0.5) * 0.2),
      r: Math.round((0.9 + rnd() * 1.1) * 10) / 10,
      accent: rnd() > 0.95,
    }));
  });
}

export function HeroPoster() {
  const rows = dots();
  return (
    <svg className="hero-poster-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      {rows.map((pts, i) => (
        <g key={ROWS[i].label}>
          <text x={px(ROWS[i].lo) - 12} y={py(ROWS[i].y) + 4} textAnchor="end" className="hero-poster-label">
            {ROWS[i].label}
          </text>
          {pts.map((d, j) => (
            <circle key={j} cx={d.x} cy={d.y} r={d.r} className={d.accent ? "hero-poster-dot is-accent" : "hero-poster-dot"} />
          ))}
        </g>
      ))}
      <line x1={px(PRICE_X)} x2={px(PRICE_X)} y1={py(1.5)} y2={py(-1.5)} className="hero-poster-price" />
      <text x={px(PRICE_X)} y={py(1.5) - 10} textAnchor="middle" className="hero-poster-label is-price">
        Market price
      </text>
    </svg>
  );
}
