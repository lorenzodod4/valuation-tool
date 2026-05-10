"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";

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
const EMA_ALPHA = 0.05;

function priceToY(price: number, smoothMin: number, smoothMax: number): number {
  const range = Math.max(smoothMax - smoothMin, 1e-6);
  const padding = range * PADDING_PCT;
  const min = smoothMin - padding;
  const max = smoothMax + padding;
  const t = (price - min) / (max - min);
  return DRAW_BOTTOM - t * (DRAW_BOTTOM - DRAW_TOP);
}

function generateCandle(prevClose: number): Candle {
  const direction = Math.random() > 0.48 ? 1 : -1;
  const volatility = 8 + Math.random() * 18;
  const change = direction * Math.random() * volatility;
  const open = prevClose;
  const close = open + change;
  const high = Math.max(open, close) + Math.random() * 8;
  const low = Math.min(open, close) - Math.random() * 8;
  return { open, close, high, low, isUp: close >= open };
}

function rangeOf(candles: Candle[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }
  return { min, max };
}

export function CandlestickBackground() {
  // Subscribing to theme makes the SVG re-render on theme flip so var()-driven
  // colors repaint cleanly.
  const { theme } = useTheme();

  // Refs hold the actual animation state; a single state counter forces React
  // to repaint at the rAF cadence without the per-field setState churn.
  const candlesRef = useRef<Candle[]>([]);
  const offsetRef = useRef(0);
  const smoothMinRef = useRef(0);
  const smoothMaxRef = useRef(0);
  const lastTickRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [, setFrame] = useState(0);

  useEffect(() => {
    const initial: Candle[] = [];
    let prev = 200;
    for (let i = 0; i < CANDLE_COUNT; i++) {
      const c = generateCandle(prev);
      initial.push(c);
      prev = c.close;
    }
    candlesRef.current = initial;
    const { min, max } = rangeOf(initial);
    smoothMinRef.current = min;
    smoothMaxRef.current = max;
    setFrame((f) => f + 1);

    const tick = (now: number) => {
      if (lastTickRef.current === 0) lastTickRef.current = now;
      const elapsed = now - lastTickRef.current;
      lastTickRef.current = now;

      // Target 0.6 px every 80 ms (~7.5 px/sec). Scale by elapsed for smoothness at any FPS.
      offsetRef.current += elapsed * (0.6 / 80);

      if (offsetRef.current >= CANDLE_SPACING) {
        offsetRef.current -= CANDLE_SPACING;
        const last = candlesRef.current[candlesRef.current.length - 1];
        candlesRef.current = [
          ...candlesRef.current.slice(1),
          generateCandle(last.close),
        ];
      }

      // EMA-smoothed pan/zoom toward the visible range so the chart never snaps.
      const { min: targetMin, max: targetMax } = rangeOf(candlesRef.current);
      smoothMinRef.current += (targetMin - smoothMinRef.current) * EMA_ALPHA;
      smoothMaxRef.current += (targetMax - smoothMaxRef.current) * EMA_ALPHA;

      setFrame((f) => f + 1);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = 0;
    };
  }, []);

  const candles = candlesRef.current;
  const smoothMin = smoothMinRef.current;
  const smoothMax = smoothMaxRef.current;
  const offset = offsetRef.current;
  const ready = candles.length > 0 && smoothMax > smoothMin;

  // Five gridlines at evenly-spaced price levels inside the visible range.
  const gridPrices: number[] = [];
  if (ready) {
    const range = smoothMax - smoothMin;
    const padded = range * (1 + 2 * PADDING_PCT);
    const visibleMin = smoothMin - range * PADDING_PCT;
    const step = padded / 6;
    for (let i = 1; i <= 5; i++) gridPrices.push(visibleMin + step * i);
  }

  const lastClose = ready ? candles[candles.length - 1].close : 0;
  const priceY = ready ? priceToY(lastClose, smoothMin, smoothMax) : 0;

  return (
    <svg
      data-theme={theme}
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

      {ready && (
        <>
          <g>
            {gridPrices.map((price, i) => {
              const y = priceToY(price, smoothMin, smoothMax);
              return (
                <line
                  key={i}
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

          <g transform={`translate(${-offset}, 0)`}>
            {candles.map((c, i) => {
              const x = i * CANDLE_SPACING;
              if (x < -20 || x > VIEW_W + 20) return null;
              const cx = x + CANDLE_WIDTH / 2;
              const highY = priceToY(c.high, smoothMin, smoothMax);
              const lowY = priceToY(c.low, smoothMin, smoothMax);
              const openY = priceToY(c.open, smoothMin, smoothMax);
              const closeY = priceToY(c.close, smoothMin, smoothMax);
              const bodyTop = Math.min(openY, closeY);
              const bodyHeight = Math.max(1, Math.abs(closeY - openY));
              return (
                <g key={i}>
                  <line
                    x1={cx}
                    y1={highY}
                    x2={cx}
                    y2={lowY}
                    strokeWidth={1}
                    className={
                      c.isUp ? "candle-up-stroke" : "candle-down-stroke"
                    }
                  />
                  <rect
                    x={x}
                    y={bodyTop}
                    width={CANDLE_WIDTH}
                    height={bodyHeight}
                    rx={0.5}
                    className={c.isUp ? "candle-up" : "candle-down"}
                  />
                </g>
              );
            })}
          </g>

          <g>
            <line
              x1={0}
              y1={priceY}
              x2={1180}
              y2={priceY}
              strokeWidth={0.75}
              strokeDasharray="3 4"
              className="candle-price-line"
            />
            <text
              x={1180}
              y={priceY - 4}
              textAnchor="end"
              fontSize={10}
              style={{
                fontFamily:
                  "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
              className="candle-price-text"
            >
              ${lastClose.toFixed(2)}
            </text>
          </g>
        </>
      )}

      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="url(#candle-fade)" />
    </svg>
  );
}
