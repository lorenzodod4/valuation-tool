interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  isUp: boolean;
}

const CANDLE_COUNT = 95;
const CANDLE_WIDTH = 8;
const CANDLE_SPACING = 14;
const VIEW_W = 1200;
const VIEW_H = 800;
const DRAW_TOP = 100;
const DRAW_BOTTOM = 700;
const PADDING_PCT = 0.1;

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function generateStaticCandles(): Candle[] {
  const candles: Candle[] = [];
  let prevClose = 200;

  for (let i = 0; i < CANDLE_COUNT; i++) {
    const direction = pseudoRandom(i + 1) > 0.48 ? 1 : -1;
    const volatility = 8 + pseudoRandom(i + 11) * 18;
    const change = direction * pseudoRandom(i + 23) * volatility;
    const open = prevClose;
    const close = open + change;
    const high = Math.max(open, close) + pseudoRandom(i + 37) * 8;
    const low = Math.min(open, close) - pseudoRandom(i + 41) * 8;

    candles.push({ open, close, high, low, isUp: close >= open });
    prevClose = close;
  }

  return candles;
}

function rangeOf(candles: Candle[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;

  for (const candle of candles) {
    if (candle.low < min) min = candle.low;
    if (candle.high > max) max = candle.high;
  }

  return { min, max };
}

function priceToY(price: number, minPrice: number, maxPrice: number): number {
  const range = Math.max(maxPrice - minPrice, 1e-6);
  const padding = range * PADDING_PCT;
  const min = minPrice - padding;
  const max = maxPrice + padding;
  const t = (price - min) / (max - min);
  return DRAW_BOTTOM - t * (DRAW_BOTTOM - DRAW_TOP);
}

const STATIC_CANDLES = generateStaticCandles();
const STATIC_RANGE = rangeOf(STATIC_CANDLES);
const GRID_PRICES = Array.from({ length: 5 }, (_, index) => {
  const range = STATIC_RANGE.max - STATIC_RANGE.min;
  const padded = range * (1 + 2 * PADDING_PCT);
  const visibleMin = STATIC_RANGE.min - range * PADDING_PCT;
  const step = padded / 6;
  return visibleMin + step * (index + 1);
});

export function CandlestickBackground() {
  return (
    <svg
      className="pointer-events-none absolute"
      width="100%"
      height="100%"
      style={{ inset: 0, opacity: 0.5, zIndex: 0 }}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="candle-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="fade-stop-1" />
          <stop offset="15%" className="fade-stop-0" />
          <stop offset="100%" className="fade-stop-0" />
        </linearGradient>
      </defs>

      <g>
        {GRID_PRICES.map((price, index) => {
          const y = priceToY(price, STATIC_RANGE.min, STATIC_RANGE.max);
          return (
            <line
              key={index}
              x1={0}
              y1={y}
              x2={VIEW_W}
              y2={y}
              className="candle-grid"
              strokeWidth={0.5}
            />
          );
        })}
      </g>

      <g>
        {STATIC_CANDLES.map((candle, index) => {
          const x = index * CANDLE_SPACING;
          const cx = x + CANDLE_WIDTH / 2;
          const highY = priceToY(candle.high, STATIC_RANGE.min, STATIC_RANGE.max);
          const lowY = priceToY(candle.low, STATIC_RANGE.min, STATIC_RANGE.max);
          const openY = priceToY(candle.open, STATIC_RANGE.min, STATIC_RANGE.max);
          const closeY = priceToY(candle.close, STATIC_RANGE.min, STATIC_RANGE.max);
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(1, Math.abs(closeY - openY));

          return (
            <g key={index}>
              <line
                x1={cx}
                y1={highY}
                x2={cx}
                y2={lowY}
                strokeWidth={1}
                className={candle.isUp ? "candle-up-stroke" : "candle-down-stroke"}
              />
              <rect
                x={x}
                y={bodyTop}
                width={CANDLE_WIDTH}
                height={bodyHeight}
                rx={0.5}
                className={candle.isUp ? "candle-up" : "candle-down"}
              />
            </g>
          );
        })}
      </g>

      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="url(#candle-fade)" />
    </svg>
  );
}
