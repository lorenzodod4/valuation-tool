import { Document, Font, Page, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type {
  DCFResult,
  DDMResult,
  FullValuation,
  HistoricalFinancials,
  MultiplesResult,
  ReverseDCFResult,
  SensitivityTable,
  WACCBreakdown,
} from "@/types/valuation";
import { abbreviateNumber, formatCurrency, formatMultiple, formatPercent, formatRate } from "@/lib/format";

/**
 * Printable valuation report. Same numbers as the web report (nothing is
 * recomputed here), laid out for A4: summary and football field first, then
 * the model, market expectations, comparables, history and sources.
 */

// ---------------- Fonts ----------------
// Static TrueType instances of the site's typefaces (OFL), served from /public.
Font.register({
  family: "Inter Tight",
  fonts: [
    { src: "/fonts/pdf/inter-tight-latin-400-normal.ttf", fontWeight: 400 },
    { src: "/fonts/pdf/inter-tight-latin-500-normal.ttf", fontWeight: 500 },
    { src: "/fonts/pdf/inter-tight-latin-600-normal.ttf", fontWeight: 600 },
    { src: "/fonts/pdf/inter-tight-latin-700-normal.ttf", fontWeight: 700 },
  ],
});
Font.register({
  family: "Plex Mono",
  fonts: [
    { src: "/fonts/pdf/ibm-plex-mono-latin-400-normal.ttf", fontWeight: 400 },
    { src: "/fonts/pdf/ibm-plex-mono-latin-500-normal.ttf", fontWeight: 500 },
  ],
});
Font.register({
  family: "Instrument Serif",
  fonts: [{ src: "/fonts/pdf/instrument-serif-latin-400-italic.ttf", fontStyle: "italic" }],
});
Font.registerHyphenationCallback((word) => [word]);

// ---------------- Palette (paper theme, print-safe) ----------------
const C = {
  ink: "#0F1216",
  ink2: "#3A4048",
  ink3: "#5F6670",
  ink4: "#8A9099",
  line: "#E3E5E8",
  lineStrong: "#C9CDD3",
  inset: "#F5F6F7",
  signal: "#2F55E4",
  signalSoft: "#EBF0FE",
  series2: "#E0682B",
  series3: "#159A72",
  neutral: "#A3AAB4",
  pos: "#0B734D",
  neg: "#B42318",
  warn: "#8A5805",
  warnBg: "#FDF6E7",
  heatPos: ["#E3F3EC", "#C4E6D6", "#9CD5BC"],
  heatNeg: ["#FBE9E7", "#F5CFCA", "#EEADA6"],
};

const s = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingBottom: 58,
    paddingHorizontal: 44,
    fontFamily: "Inter Tight",
    fontSize: 9,
    color: C.ink,
  },
  running: {
    position: "absolute",
    top: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8,
    borderBottomWidth: 0.6,
    borderBottomColor: C.line,
  },
  brand: { flexDirection: "row", alignItems: "center" },
  brandText: { fontSize: 9.5, fontWeight: 600, marginLeft: 6 },
  brandSuffix: { color: C.ink4, fontWeight: 400 },
  runningRight: { fontFamily: "Plex Mono", fontSize: 7, color: C.ink4, letterSpacing: 0.4 },
  foot: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 0.6,
    borderTopColor: C.line,
    fontSize: 7,
    color: C.ink4,
  },
  mono: { fontFamily: "Plex Mono" },
  eyebrow: { fontFamily: "Plex Mono", fontSize: 7, letterSpacing: 0.8, textTransform: "uppercase", color: C.ink3 },

  // Section heads
  section: { marginBottom: 20 },
  sectionHead: { marginBottom: 10, paddingBottom: 8, borderBottomWidth: 0.6, borderBottomColor: C.line },
  sectionIndex: { fontFamily: "Plex Mono", fontSize: 7.5, color: C.signal, marginBottom: 3 },
  sectionTitle: { fontSize: 15, fontWeight: 600, letterSpacing: -0.3 },
  sectionSub: { fontSize: 8.5, color: C.ink3, marginTop: 2 },
  subhead: { fontSize: 10, fontWeight: 600, marginBottom: 6 },
  body: { fontSize: 8.5, color: C.ink2, lineHeight: 1.5 },
  small: { fontSize: 7.5, color: C.ink3, lineHeight: 1.45 },

  // Cover
  idRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  pill: {
    fontFamily: "Plex Mono",
    fontSize: 8,
    fontWeight: 500,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 5,
  },
  pillSolid: { backgroundColor: C.ink, color: "#FFFFFF" },
  pillOutline: { borderWidth: 0.6, borderColor: C.lineStrong, color: C.ink3 },
  company: { fontSize: 24, fontWeight: 600, letterSpacing: -0.6, lineHeight: 1.15 },
  companyMeta: { fontSize: 8.5, color: C.ink3, marginTop: 4 },
  headline: {
    fontFamily: "Instrument Serif",
    fontStyle: "italic",
    fontSize: 15,
    lineHeight: 1.3,
    color: C.ink2,
    marginTop: 14,
    marginBottom: 16,
  },

  // Figure strip
  strip: {
    flexDirection: "row",
    borderWidth: 0.6,
    borderColor: C.line,
    borderRadius: 6,
    marginBottom: 22,
  },
  stripCell: { flex: 1, paddingVertical: 9, paddingHorizontal: 10, borderLeftWidth: 0.6, borderLeftColor: C.line },
  stripFirst: { borderLeftWidth: 0 },
  stripPrimary: { backgroundColor: C.signalSoft },
  stripLabel: { fontSize: 7, color: C.ink3, marginBottom: 3 },
  stripValue: { fontSize: 12, fontWeight: 600, letterSpacing: -0.3 },
  stripNote: { fontSize: 6.5, color: C.ink4, marginTop: 2 },

  // Notices
  notice: {
    backgroundColor: C.warnBg,
    borderLeftWidth: 2,
    borderLeftColor: C.warn,
    padding: "8 10",
    marginBottom: 16,
    borderRadius: 3,
  },
  noticeTitle: { fontSize: 8, fontWeight: 600, color: C.warn, marginBottom: 3 },
  noticeItem: { fontSize: 7.8, color: C.ink2, marginBottom: 2 },

  // Range field
  ffHead: { flexDirection: "row", marginBottom: 2 },
  ffLabelCol: { width: 82 },
  ffTrackCol: { flex: 1 },
  ffValCol: { width: 150, flexDirection: "row" },
  ffValCell: { flex: 1, textAlign: "right" },
  ffHeadText: { fontFamily: "Plex Mono", fontSize: 6.5, color: C.ink4, letterSpacing: 0.6 },
  ffRow: { flexDirection: "row", height: 30, borderTopWidth: 0.6, borderTopColor: C.line, alignItems: "center" },
  ffLabel: { fontSize: 8.5, fontWeight: 600 },
  ffSub: { fontSize: 6.5, color: C.ink4 },
  ffTrack: { position: "relative", height: 30 },
  ffValues: { fontFamily: "Plex Mono", fontSize: 7.5, color: C.ink3 },
  ffBase: { color: C.ink, fontWeight: 500 },
  axisRow: { flexDirection: "row", borderTopWidth: 0.8, borderTopColor: C.lineStrong, height: 30 },
  tick: { position: "absolute", top: 4, fontFamily: "Plex Mono", fontSize: 6.5, color: C.ink4, width: 50, marginLeft: -25, textAlign: "center" },
  marketLabel: { position: "absolute", top: 15, width: 110, marginLeft: -55, textAlign: "center", fontSize: 7, color: C.ink2 },

  // KPI row
  kpis: { flexDirection: "row", marginBottom: 12 },
  kpi: { flex: 1, paddingRight: 10, paddingTop: 8, borderTopWidth: 1.2, borderTopColor: C.ink, marginRight: 10 },
  kpiLast: { marginRight: 0 },
  kpiLabel: { fontSize: 7, color: C.ink3 },
  kpiValue: { fontSize: 14, fontWeight: 600, letterSpacing: -0.3, marginTop: 2 },
  kpiNote: { fontSize: 6.8, color: C.ink4, marginTop: 1 },

  // Tables
  table: { marginBottom: 14 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 3.4 },
  trHead: { borderBottomWidth: 0.8, borderBottomColor: C.lineStrong, paddingBottom: 4 },
  trEmph: { backgroundColor: C.inset },
  trStrong: { borderTopWidth: 0.8, borderTopColor: C.ink, borderBottomWidth: 0 },
  th: { fontFamily: "Plex Mono", fontSize: 6.8, color: C.ink3, letterSpacing: 0.4 },
  td: { fontSize: 8 },
  num: { fontFamily: "Plex Mono", fontSize: 7.8, textAlign: "right" },
  muted: { color: C.ink3 },

  split: { flexDirection: "row", marginBottom: 14 },
  splitCol: { flex: 1 },
  splitGap: { width: 22 },

  kv: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2.6, borderBottomWidth: 0.5, borderBottomColor: C.line },
  kvLabel: { fontSize: 8, color: C.ink2, flex: 1, paddingRight: 8 },
  kvLabelStacked: { fontSize: 8, color: C.ink2 },
  kvNote: { fontSize: 6.2, color: C.ink4 },
  kvValue: { fontFamily: "Plex Mono", fontSize: 8 },

  card: { borderWidth: 0.6, borderColor: C.line, borderRadius: 5, padding: 10 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 10, fontSize: 8, color: C.ink4 },
});

// ---------------- Helpers ----------------

const finite = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);

/** The embedded Latin subsets lack a few math glyphs; keep dynamic text printable. */
function printable(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/→/g, "->")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/β/g, "beta")
    .replace(/Σ/g, "Sum of")
    .replace(/Δ/g, "Change in ");
}

function truncate(text: string | null | undefined, max: number): string {
  const t = printable(text);
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function niceStep(span: number, target: number): number {
  const raw = span / Math.max(1, target);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / pow;
  return (unit < 1.5 ? 1 : unit < 3 ? 2 : unit < 7 ? 5 : 10) * pow;
}

function scale(values: number[], targetTicks = 4, includeZero = false) {
  let min = Math.min(...values, ...(includeZero ? [0] : []));
  let max = Math.max(...values, ...(includeZero ? [0] : []));
  if (min === max) {
    min -= Math.abs(min) * 0.2 || 1;
    max += Math.abs(max) * 0.2 || 1;
  }
  const pad = includeZero ? 0 : (max - min) * 0.08;
  const step = niceStep(max - min + 2 * pad, targetTicks);
  const lo = Math.floor((min - pad) / step) * step;
  const hi = Math.ceil((max + pad) / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Number(t.toPrecision(12)));
  return { lo, hi, step, ticks, pct: (v: number) => ((v - lo) / (hi - lo)) * 100 };
}

const pctStr = (n: number) => `${Math.max(0, Math.min(100, n)).toFixed(3)}%`;

function toneColor(n: number | null | undefined): string {
  if (!finite(n) || n === 0) return C.ink3;
  return n > 0 ? C.pos : C.neg;
}

// ---------------- Chrome ----------------

function Mark({ size = 12 }: { size?: number }) {
  // Same glyph as the site header: one cash flow, worth less the further out it lands.
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Rect x={1} y={3} width={3.6} height={16} rx={1} fill={C.signal} />
      <Rect x={6.6} y={6} width={3.6} height={13} rx={1} fill={C.signal} fillOpacity={0.78} />
      <Rect x={12.2} y={9} width={3.6} height={10} rx={1} fill={C.signal} fillOpacity={0.56} />
      <Rect x={17.8} y={11.5} width={3.2} height={7.5} rx={1} fill={C.signal} fillOpacity={0.36} />
    </Svg>
  );
}

function Running({ symbol, name, date }: { symbol: string; name: string | null; date: string }) {
  return (
    <View style={s.running} fixed>
      <View style={s.brand}>
        <Mark />
        <Text style={s.brandText}>
          Valuation<Text style={s.brandSuffix}>.io</Text>
        </Text>
      </View>
      <Text style={s.runningRight}>
        {symbol}
        {name ? ` · ${truncate(name, 48)}` : ""} · EQUITY VALUATION REPORT · {date.toUpperCase()}
      </Text>
    </View>
  );
}

function Foot() {
  return (
    <View style={s.foot} fixed>
      <Text>Educational use only — not investment advice. Auto-derived assumptions are starting points.</Text>
      <Text style={s.mono} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function SectionHead({ index, title, sub }: { index: string; title: string; sub?: string }) {
  return (
    <View style={s.sectionHead} minPresenceAhead={120}>
      <Text style={s.sectionIndex}>{index}</Text>
      <Text style={s.sectionTitle}>{title}</Text>
      {sub ? <Text style={s.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

function KV({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <View style={s.kv} wrap={false}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={s.kvLabelStacked}>{label}</Text>
        {note ? <Text style={s.kvNote}>{printable(note)}</Text> : null}
      </View>
      <Text style={s.kvValue}>{value}</Text>
    </View>
  );
}

function Bullets({ items, color = C.ink2 }: { items: string[]; color?: string }) {
  return (
    <View>
      {items.map((t, i) => (
        <View key={i} style={s.bullet} wrap={false}>
          <Text style={s.bulletDot}>–</Text>
          <Text style={[s.body, { flex: 1, color }]}>{printable(t)}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------------- Charts ----------------

interface FieldRow {
  label: string;
  sub: string;
  base: number;
  low: number | null;
  high: number | null;
  emphasis?: boolean;
}

/** Football field: bars are ranges, the tick is the base case; supports negatives. */
function RangeField({ rows, price, currency }: { rows: FieldRow[]; price: number | null; currency?: string | null }) {
  const values = rows.flatMap((r) => [r.base, r.low, r.high]).filter(finite);
  if (finite(price) && price > 0) values.push(price);
  if (values.length === 0) return <Text style={s.body}>No valuation method produced a value.</Text>;
  const sc = scale(values, 4);
  const decimals = Math.max(...values.map(Math.abs)) < 100 ? 2 : 0;
  const tickDecimals = sc.step >= 1 ? 0 : sc.step >= 0.1 ? 1 : 2;
  const money = (n: number, d = decimals) => formatCurrency(n, d, currency);

  return (
    <View wrap={false}>
      <View style={s.ffHead}>
        <View style={s.ffLabelCol} />
        <View style={s.ffTrackCol} />
        <View style={s.ffValCol}>
          {["LOW", "BASE", "HIGH"].map((h) => (
            <Text key={h} style={[s.ffHeadText, s.ffValCell]}>{h}</Text>
          ))}
        </View>
      </View>
      {rows.map((r) => {
        const hasRange = finite(r.low) && finite(r.high) && r.high > r.low;
        return (
          <View key={r.label} style={s.ffRow}>
            <View style={s.ffLabelCol}>
              <Text style={s.ffLabel}>{r.label}</Text>
              <Text style={s.ffSub}>{r.sub}</Text>
            </View>
            <View style={[s.ffTrackCol, s.ffTrack]}>
              {sc.ticks.map((t) => (
                <View key={t} style={{ position: "absolute", top: 0, bottom: 0, left: pctStr(sc.pct(t)), width: 0.5, backgroundColor: C.line }} />
              ))}
              {sc.lo < 0 && sc.hi > 0 ? (
                <View style={{ position: "absolute", top: 0, bottom: 0, left: pctStr(sc.pct(0)), width: 0.8, backgroundColor: C.ink4 }} />
              ) : null}
              {hasRange ? (
                <View
                  style={{
                    position: "absolute",
                    top: 10,
                    height: 10,
                    borderRadius: 3,
                    left: pctStr(sc.pct(r.low as number)),
                    width: pctStr(sc.pct(r.high as number) - sc.pct(r.low as number)),
                    backgroundColor: r.emphasis ? C.signal : C.neutral,
                    opacity: r.emphasis ? 0.9 : 0.7,
                  }}
                />
              ) : null}
              {finite(price) && price > 0 ? (
                <View style={{ position: "absolute", top: 0, bottom: 0, left: pctStr(sc.pct(price)), width: 1.2, backgroundColor: C.ink }} />
              ) : null}
              {hasRange ? (
                <View style={{ position: "absolute", top: 6, height: 18, width: 2.4, marginLeft: -1.2, left: pctStr(sc.pct(r.base)), backgroundColor: C.ink, borderRadius: 1 }} />
              ) : (
                <View
                  style={{
                    position: "absolute",
                    top: 11,
                    width: 8,
                    height: 8,
                    marginLeft: -4,
                    left: pctStr(sc.pct(r.base)),
                    transform: "rotate(45deg)",
                    backgroundColor: r.emphasis ? C.signal : C.ink2,
                  }}
                />
              )}
            </View>
            <View style={s.ffValCol}>
              <Text style={[s.ffValues, s.ffValCell]}>{hasRange ? money(r.low as number) : "—"}</Text>
              <Text style={[s.ffValues, s.ffValCell, s.ffBase]}>{money(r.base)}</Text>
              <Text style={[s.ffValues, s.ffValCell]}>{hasRange ? money(r.high as number) : "—"}</Text>
            </View>
          </View>
        );
      })}
      <View style={s.axisRow}>
        <View style={s.ffLabelCol} />
        <View style={[s.ffTrackCol, { position: "relative" }]}>
          {sc.ticks.map((t) => (
            <Text key={t} style={[s.tick, { left: pctStr(sc.pct(t)) }]}>{money(t, tickDecimals)}</Text>
          ))}
          {finite(price) && price > 0 ? (
            <Text style={[s.marketLabel, { left: pctStr(sc.pct(price)) }]}>
              Market <Text style={{ fontWeight: 600, color: C.ink }}>{money(price, 2)}</Text>
            </Text>
          ) : null}
        </View>
        <View style={s.ffValCol} />
      </View>
    </View>
  );
}

/** Horizontal composition bar: parts as shares of a whole. */
function CompositionBar({ parts }: { parts: Array<{ label: string; value: number; color: string }> }) {
  // Shares only make sense when every part is positive (not for loss-makers).
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!(total > 0) || parts.some((p) => !(p.value >= 0))) return null;
  return (
    <View wrap={false} style={{ marginBottom: 14 }}>
      <Text style={s.subhead}>Where the value comes from</Text>
      <View style={{ flexDirection: "row", height: 12, borderRadius: 3, overflow: "hidden" }}>
        {parts.map((p) => (
          <View key={p.label} style={{ width: pctStr((Math.max(p.value, 0) / total) * 100), backgroundColor: p.color }} />
        ))}
      </View>
      <View style={{ flexDirection: "row", marginTop: 5 }}>
        {parts.map((p) => (
          <View key={p.label} style={{ flexDirection: "row", alignItems: "center", marginRight: 14 }}>
            <View style={{ width: 7, height: 7, borderRadius: 1.5, backgroundColor: p.color, marginRight: 4 }} />
            <Text style={s.small}>
              {p.label} <Text style={{ fontFamily: "Plex Mono", color: C.ink }}>{formatRate(Math.max(p.value, 0) / total, 0)}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Grouped bars per year; negatives drop below a visible zero line. */
function HistoryChart({ data, currency }: { data: HistoricalFinancials["historical"]; currency?: string | null }) {
  const series = [
    { key: "revenue" as const, label: "Revenue", color: C.signal },
    { key: "ebitda" as const, label: "EBITDA", color: C.series2 },
    { key: "net_income" as const, label: "Net income", color: C.series3 },
  ];
  const rows = [...data].sort((a, b) => a.year - b.year);
  const values = rows.flatMap((r) => series.map((x) => r[x.key])).filter(finite);
  if (values.length === 0) return <Text style={s.body}>No historical figures were reported.</Text>;
  const sc = scale(values, 4, true);
  const H = 130;
  const y = (v: number) => H * (1 - sc.pct(v) / 100);
  const zero = y(0);

  return (
    <View wrap={false} style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 46, height: H, position: "relative" }}>
          {sc.ticks.map((t) => (
            <Text key={t} style={{ position: "absolute", right: 6, top: y(t) - 4, fontFamily: "Plex Mono", fontSize: 6.3, color: C.ink4 }}>
              {abbreviateNumber(t, currency, 0)}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1, height: H, position: "relative" }}>
          {sc.ticks.map((t) => (
            <View key={t} style={{ position: "absolute", left: 0, right: 0, top: y(t), height: 0.5, backgroundColor: t === 0 ? C.ink4 : C.line }} />
          ))}
          <View style={{ flexDirection: "row", height: H }}>
            {rows.map((r) => (
              <View key={r.year} style={{ flex: 1, position: "relative" }}>
                {series.map((x, i) => {
                  const v = r[x.key];
                  if (!finite(v)) return null;
                  const top = Math.min(y(v), zero);
                  return (
                    <View
                      key={x.key}
                      style={{
                        position: "absolute",
                        left: `${22 + i * 19}%`,
                        width: "16%",
                        top,
                        height: Math.max(Math.abs(y(v) - zero), 0.6),
                        backgroundColor: x.color,
                        borderRadius: 1,
                      }}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", marginLeft: 46, marginTop: 4 }}>
        {rows.map((r) => (
          <Text key={r.year} style={{ flex: 1, textAlign: "center", fontFamily: "Plex Mono", fontSize: 7, color: C.ink3 }}>
            {r.year}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", marginLeft: 46, marginTop: 6 }}>
        {series.map((x) => (
          <View key={x.key} style={{ flexDirection: "row", alignItems: "center", marginRight: 14 }}>
            <View style={{ width: 7, height: 7, borderRadius: 1.5, backgroundColor: x.color, marginRight: 4 }} />
            <Text style={s.small}>{x.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function heat(value: number | null, price: number | null): string {
  if (!finite(value) || !finite(price) || price <= 0) return "#FFFFFF";
  const d = (value - price) / price;
  if (d > 0.2) return C.heatPos[2];
  if (d > 0.1) return C.heatPos[1];
  if (d > 0) return C.heatPos[0];
  if (d > -0.1) return C.heatNeg[0];
  if (d > -0.2) return C.heatNeg[1];
  return C.heatNeg[2];
}

const near = (a: number | undefined, b: number) => a != null && Math.abs(a - b) < 1e-9;

function SensitivityGrid({ data, currency }: { data: SensitivityTable; currency?: string | null }) {
  const { wacc_values, terminal_growth_values, grid, current_price } = data;
  const cellW = `${(100 - 16) / Math.max(1, wacc_values.length)}%`;
  return (
    <View wrap={false}>
      <View style={[s.tr, s.trHead]}>
        <Text style={[s.th, { width: "16%" }]}>g / WACC</Text>
        {wacc_values.map((w) => (
          <Text key={w} style={[s.th, { width: cellW, textAlign: "center", color: near(data.base_wacc, w) ? C.ink : C.ink3 }]}>
            {formatRate(w)}
          </Text>
        ))}
      </View>
      {terminal_growth_values.map((g, i) => (
        <View key={g} style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#FFFFFF" }}>
          <Text style={[s.num, { width: "16%", textAlign: "left", paddingVertical: 6, color: near(data.base_terminal_growth, g) ? C.ink : C.ink3 }]}>
            {formatRate(g)}
          </Text>
          {wacc_values.map((w, j) => {
            const v = grid[i]?.[j] ?? null;
            const isBase = near(data.base_wacc, w) && near(data.base_terminal_growth, g);
            const delta = finite(v) && finite(current_price) && current_price > 0 ? v / current_price - 1 : null;
            return (
              <View
                key={w}
                style={{
                  width: cellW,
                  paddingVertical: 4,
                  backgroundColor: heat(v, current_price),
                  borderWidth: isBase ? 1.2 : 0,
                  borderColor: C.ink,
                  borderLeftWidth: isBase ? 1.2 : 0.5,
                  borderLeftColor: isBase ? C.ink : "#FFFFFF",
                }}
              >
                <Text style={[s.num, { textAlign: "center", fontWeight: isBase ? 500 : 400 }]}>
                  {finite(v) ? formatCurrency(v, 2, currency) : "n/a"}
                </Text>
                <Text style={{ fontFamily: "Plex Mono", fontSize: 6.2, textAlign: "center", color: C.ink2 }}>
                  {delta != null ? formatPercent(delta, 0) : ""}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
        <Text style={[s.small, { marginRight: 5 }]}>Below market</Text>
        {[...C.heatNeg].reverse().concat(C.heatPos).map((c) => (
          <View key={c} style={{ width: 16, height: 7, backgroundColor: c, marginRight: 2 }} />
        ))}
        <Text style={[s.small, { marginLeft: 3 }]}>Above market</Text>
        <View style={{ width: 12, height: 7, borderWidth: 1.2, borderColor: C.ink, marginLeft: 14, marginRight: 4 }} />
        <Text style={s.small}>Base case</Text>
      </View>
    </View>
  );
}

/** Reverse DCF on the solver's growth scale: implied growth vs the base case. */
function GrowthScale({ data, baseY1 }: { data: ReverseDCFResult; baseY1: number | null }) {
  const lo = data.growth_floor;
  const hi = data.growth_ceiling;
  if (!(hi > lo)) return null;
  const p = (v: number) => pctStr(((v - lo) / (hi - lo)) * 100);
  const implied = Math.min(hi, Math.max(lo, data.implied_growth_rate));
  const ticks: number[] = [];
  for (let t = Math.ceil(lo * 10) / 10; t <= hi + 1e-9; t += 0.1) ticks.push(Number(t.toFixed(2)));
  return (
    <View wrap={false} style={{ marginTop: 6, marginBottom: 16 }}>
      <View style={{ height: 44, position: "relative" }}>
        <View style={{ position: "absolute", left: 0, right: 0, top: 22, height: 1.2, backgroundColor: C.lineStrong }} />
        {baseY1 != null && baseY1 >= lo && baseY1 <= hi ? (
          <View style={{ position: "absolute", top: 12, left: p(baseY1), width: 0, height: 22, borderLeftWidth: 1, borderLeftColor: C.ink3, borderStyle: "dashed" }}>
            <Text style={{ position: "absolute", top: -11, left: -40, width: 80, textAlign: "center", fontFamily: "Plex Mono", fontSize: 6.5, color: C.ink3 }}>
              Base Y1 {formatRate(baseY1, 1)}
            </Text>
          </View>
        ) : null}
        <View style={{ position: "absolute", top: 17, left: p(implied), marginLeft: -5.5, width: 11, height: 11, borderRadius: 6, backgroundColor: C.signal }} />
        <Text style={{ position: "absolute", top: 32, left: p(implied), marginLeft: -50, width: 100, textAlign: "center", fontFamily: "Plex Mono", fontSize: 7, color: C.ink }}>
          Implied {formatRate(data.implied_growth_rate, 1)}
        </Text>
      </View>
      <View style={{ height: 12, position: "relative", marginTop: 2 }}>
        {ticks.map((t) => (
          <Text key={t} style={{ position: "absolute", left: p(t), marginLeft: -20, width: 40, textAlign: "center", fontFamily: "Plex Mono", fontSize: 6.2, color: C.ink4 }}>
            {formatRate(t, 0)}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ---------------- Model blocks ----------------

function WaccBuildUp({ wb, equityOnly = false }: { wb: WACCBreakdown; equityOnly?: boolean }) {
  return (
    <View wrap={false} style={{ marginBottom: 14 }}>
      <Text style={s.subhead}>{equityOnly ? "Cost of equity build-up" : "Discount rate build-up"}</Text>
      <KV label="Risk-free rate" value={formatRate(wb.risk_free_rate)} note={wb.rf_source} />
      <KV label="Equity risk premium" value={formatRate(wb.equity_risk_premium)} note={wb.erp_source} />
      <KV label="Beta" value={finite(wb.beta) ? wb.beta.toFixed(2) : "—"} note={wb.beta_source} />
      <KV label="Cost of equity (Rf + beta x ERP)" value={formatRate(wb.cost_of_equity)} />
      {!equityOnly ? (
        <>
          <KV label="Pre-tax cost of debt" value={formatRate(wb.cost_of_debt_pretax)} />
          <KV label="After-tax cost of debt" value={formatRate(wb.cost_of_debt_aftertax)} note={`Tax rate ${formatRate(wb.tax_rate, 1)}`} />
          <KV label="Weights, equity / debt" value={`${formatRate(wb.weight_equity, 1)} / ${formatRate(wb.weight_debt, 1)}`} />
          <View style={[s.kv, { borderBottomWidth: 0, borderTopWidth: 0.8, borderTopColor: C.ink }]}>
            <Text style={[s.kvLabel, { fontWeight: 600, color: C.ink }]}>WACC</Text>
            <Text style={[s.kvValue, { color: C.signal, fontWeight: 500 }]}>{formatRate(wb.wacc)}</Text>
          </View>
        </>
      ) : null}
      <Text style={[s.small, { marginTop: 4 }]}>Oldest market input dated {wb.data_as_of}.</Text>
    </View>
  );
}

function DCFBlock({ dcf, currency }: { dcf: DCFResult; currency?: string | null }) {
  const a = dcf.assumptions_used as {
    wacc?: number;
    terminal_growth_rate?: number;
    tax_rate?: number;
    ebit_margin?: number;
    da_pct_revenue?: number;
    capex_pct_revenue?: number;
    wc_change_pct_revenue?: number;
    historical_cagr_3y?: number;
    revenue_growth_rates?: number[];
  };
  const money = (n: number | null | undefined, d = 2) => abbreviateNumber(n, currency, d);
  const pvSum = dcf.projections.reduce((t, p) => t + p.pv_fcff, 0);
  const tvShare = dcf.enterprise_value > 0 ? dcf.pv_terminal_value / dcf.enterprise_value : null;
  const negative = finite(dcf.per_share_value) && dcf.per_share_value <= 0;
  const colW = `${72 / Math.max(1, dcf.projections.length)}%`;

  const rows: Array<{ label: string; cells: string[]; emph?: boolean; muted?: boolean }> = [
    { label: "Revenue", cells: dcf.projections.map((p) => money(p.revenue)) },
    { label: "Growth", cells: dcf.projections.map((_, i) => formatRate(a.revenue_growth_rates?.[i], 1)), muted: true },
    { label: "EBIT", cells: dcf.projections.map((p) => money(p.ebit)) },
    { label: "NOPAT", cells: dcf.projections.map((p) => money(p.nopat)) },
    { label: "Free cash flow (FCFF)", cells: dcf.projections.map((p) => money(p.fcff)) },
    {
      label: "Discount factor",
      cells: dcf.projections.map((p) => (finite(a.wacc) ? (1 / (1 + a.wacc) ** p.year).toFixed(3) : "—")),
      muted: true,
    },
    { label: "Present value", cells: dcf.projections.map((p) => money(p.pv_fcff)), emph: true },
  ];

  return (
    <View>
      <View style={s.kpis} wrap={false}>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>Value per share</Text>
          <Text style={[s.kpiValue, negative ? { color: C.neg } : {}]}>{formatCurrency(dcf.per_share_value, 2, currency)}</Text>
          <Text style={[s.kpiNote, { color: negative ? C.neg : toneColor(dcf.upside_pct) }]}>
            {negative ? "Negative equity value" : `${formatPercent(dcf.upside_pct)} vs market`}
          </Text>
        </View>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>Enterprise value</Text>
          <Text style={s.kpiValue}>{money(dcf.enterprise_value)}</Text>
          <Text style={s.kpiNote}>PV of FCFF + PV of TV</Text>
        </View>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>Equity value</Text>
          <Text style={s.kpiValue}>{money(dcf.equity_value)}</Text>
          <Text style={s.kpiNote}>EV − net debt</Text>
        </View>
        <View style={[s.kpi, s.kpiLast]}>
          <Text style={s.kpiLabel}>Terminal value share</Text>
          <Text style={[s.kpiValue, tvShare != null && tvShare > 0.85 ? { color: C.warn } : {}]}>{formatRate(tvShare, 0)}</Text>
          <Text style={s.kpiNote}>{tvShare != null && tvShare > 0.85 ? "High dependence on Y5+" : "of enterprise value"}</Text>
        </View>
      </View>

      <View style={s.table} wrap={false}>
        <View style={[s.tr, s.trHead]}>
          <Text style={[s.th, { width: "28%" }]}>{currency ?? "USD"}</Text>
          {dcf.projections.map((p) => (
            <Text key={p.year} style={[s.th, { width: colW, textAlign: "right" }]}>Y{p.year}</Text>
          ))}
        </View>
        {rows.map((r) => (
          <View key={r.label} style={[s.tr, r.emph ? s.trEmph : {}]}>
            <Text style={[s.td, { width: "28%", fontWeight: r.emph ? 600 : 400 }]}>{r.label}</Text>
            {r.cells.map((c, i) => (
              <Text key={i} style={[s.num, { width: colW }, r.muted ? s.muted : {}]}>{c}</Text>
            ))}
          </View>
        ))}
      </View>

      <CompositionBar
        parts={[
          { label: "PV of FCFF, Y1–Y5", value: pvSum, color: C.signal },
          { label: "PV of terminal value", value: dcf.pv_terminal_value, color: C.neutral },
        ]}
      />

      <View style={s.split}>
        <View style={s.splitCol} wrap={false}>
          <Text style={s.subhead}>From cash flow to value per share</Text>
          <KV label="Sum of PV of FCFF, Y1–Y5" value={money(pvSum)} />
          <KV label="+ PV of terminal value" value={money(dcf.pv_terminal_value)} />
          <KV label="= Enterprise value" value={money(dcf.enterprise_value)} />
          <KV label="− Net debt" value={money(dcf.net_debt)} />
          <KV label="= Equity value" value={money(dcf.equity_value)} />
          <KV
            label="÷ Shares outstanding"
            value={dcf.shares_outstanding ? `${(dcf.shares_outstanding / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })}M` : "—"}
          />
          <View style={[s.kv, { borderBottomWidth: 0, borderTopWidth: 0.8, borderTopColor: C.ink }]}>
            <Text style={[s.kvLabel, { fontWeight: 600, color: C.ink }]}>= Value per share</Text>
            <Text style={[s.kvValue, { fontWeight: 500 }]}>{formatCurrency(dcf.per_share_value, 2, currency)}</Text>
          </View>
        </View>
        <View style={s.splitGap} />
        <View style={s.splitCol} wrap={false}>
          <Text style={s.subhead}>Assumptions</Text>
          <KV label="Revenue growth, Y1" value={formatRate(a.revenue_growth_rates?.[0], 1)} note={`Fades to terminal growth by Y5 · 3y CAGR ${formatRate(a.historical_cagr_3y, 1)}`} />
          <KV label="EBIT margin" value={formatRate(a.ebit_margin, 1)} note="3-year average" />
          <KV label="Tax rate" value={formatRate(a.tax_rate, 1)} note="Effective, clamped 0–35%" />
          <KV label="D&A / CapEx / change in WC" value={`${formatRate(a.da_pct_revenue, 1)} / ${formatRate(a.capex_pct_revenue, 1)} / ${formatRate(a.wc_change_pct_revenue, 1)}`} note="% of revenue" />
          <KV label="WACC" value={formatRate(a.wacc)} note={dcf.wacc_breakdown ? "Derived — see build-up" : "User override"} />
          <KV label="Terminal growth" value={formatRate(a.terminal_growth_rate)} note="Gordon growth after Y5" />
        </View>
      </View>

      {dcf.wacc_breakdown ? <WaccBuildUp wb={dcf.wacc_breakdown} /> : null}
      {dcf.warnings.length > 0 ? (
        <View wrap={false}>
          <Text style={s.subhead}>Model flags</Text>
          <Bullets items={dcf.warnings} />
        </View>
      ) : null}
    </View>
  );
}

function DDMBlock({ ddm, currency }: { ddm: DDMResult; currency?: string | null }) {
  const a = ddm.assumptions_used as {
    cost_of_equity?: number;
    dividend_growth_rate?: number;
    terminal_growth_rate?: number;
    payout_ratio?: number | null;
  };
  const money = (n: number | null | undefined) => formatCurrency(n, 2, currency);
  const pvSum = ddm.projections.reduce((t, p) => t + p.pv_dps, 0);
  const tvShare = finite(ddm.per_share_value) && ddm.per_share_value > 0 && finite(ddm.pv_terminal_value) ? ddm.pv_terminal_value / ddm.per_share_value : null;
  const colW = `${72 / Math.max(1, ddm.projections.length)}%`;

  return (
    <View>
      <Text style={[s.body, { marginBottom: 12 }]}>
        Selected automatically for this sector: for banks, insurers and REITs, free cash flow is not a meaningful
        measure of value, so the model discounts the dividends shareholders actually receive.
      </Text>
      <View style={s.kpis} wrap={false}>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>Value per share</Text>
          <Text style={s.kpiValue}>{money(ddm.per_share_value)}</Text>
          <Text style={[s.kpiNote, { color: toneColor(ddm.upside_pct) }]}>{formatPercent(ddm.upside_pct)} vs market</Text>
        </View>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>Latest dividend / share</Text>
          <Text style={s.kpiValue}>{money(ddm.latest_dps)}</Text>
          <Text style={s.kpiNote}>Common dividends ÷ shares</Text>
        </View>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>Dividend yield</Text>
          <Text style={s.kpiValue}>{formatRate(ddm.dividend_yield)}</Text>
          <Text style={s.kpiNote}>at market price</Text>
        </View>
        <View style={[s.kpi, s.kpiLast]}>
          <Text style={s.kpiLabel}>Terminal value share</Text>
          <Text style={s.kpiValue}>{formatRate(tvShare, 0)}</Text>
          <Text style={s.kpiNote}>of value per share</Text>
        </View>
      </View>

      {ddm.projections.length > 0 ? (
        <View style={s.table} wrap={false}>
          <View style={[s.tr, s.trHead]}>
            <Text style={[s.th, { width: "28%" }]}>Per share, {currency ?? "USD"}</Text>
            {ddm.projections.map((p) => (
              <Text key={p.year} style={[s.th, { width: colW, textAlign: "right" }]}>Y{p.year}</Text>
            ))}
          </View>
          <View style={s.tr}>
            <Text style={[s.td, { width: "28%" }]}>Dividend</Text>
            {ddm.projections.map((p) => <Text key={p.year} style={[s.num, { width: colW }]}>{money(p.dps)}</Text>)}
          </View>
          <View style={[s.tr, s.trEmph]}>
            <Text style={[s.td, { width: "28%", fontWeight: 600 }]}>Present value</Text>
            {ddm.projections.map((p) => <Text key={p.year} style={[s.num, { width: colW }]}>{money(p.pv_dps)}</Text>)}
          </View>
        </View>
      ) : null}

      {finite(ddm.pv_terminal_value) ? (
        <CompositionBar
          parts={[
            { label: "PV of dividends, Y1–Y5", value: pvSum, color: C.signal },
            { label: "PV of terminal value", value: ddm.pv_terminal_value, color: C.neutral },
          ]}
        />
      ) : null}

      <View style={s.split}>
        <View style={s.splitCol} wrap={false}>
          <Text style={s.subhead}>From dividends to value per share</Text>
          <KV label="Sum of PV of dividends, Y1–Y5" value={ddm.projections.length ? money(pvSum) : "—"} />
          <KV label="+ PV of terminal value" value={money(ddm.pv_terminal_value)} />
          <View style={[s.kv, { borderBottomWidth: 0, borderTopWidth: 0.8, borderTopColor: C.ink }]}>
            <Text style={[s.kvLabel, { fontWeight: 600, color: C.ink }]}>= Value per share</Text>
            <Text style={[s.kvValue, { fontWeight: 500 }]}>{money(ddm.per_share_value)}</Text>
          </View>
        </View>
        <View style={s.splitGap} />
        <View style={s.splitCol} wrap={false}>
          <Text style={s.subhead}>Assumptions</Text>
          <KV label="Cost of equity" value={formatRate(a.cost_of_equity)} note="CAPM" />
          <KV label="Dividend growth, Y1–Y5" value={formatRate(a.dividend_growth_rate)} note="Historical CAGR, capped 0–10%" />
          <KV label="Terminal growth" value={formatRate(a.terminal_growth_rate)} note="min(2%, 0.8 x dividend growth)" />
          <KV label="Payout ratio" value={formatRate(a.payout_ratio ?? null, 1)} note="Dividends ÷ net income" />
        </View>
      </View>

      {ddm.wacc_breakdown ? <WaccBuildUp wb={ddm.wacc_breakdown} equityOnly /> : null}
      {ddm.warnings.length > 0 ? (
        <View wrap={false}>
          <Text style={s.subhead}>Model flags</Text>
          <Bullets items={ddm.warnings} />
        </View>
      ) : null}
    </View>
  );
}

function Comparables({ m, symbol, name, currency }: { m: MultiplesResult; symbol: string; name: string | null; currency?: string | null }) {
  const peers = m.peer_statistics.peers ?? [];
  const st = m.peer_statistics.statistics;
  const t = m.target_metrics;
  const cols: Array<{ key: "pe_ratio" | "ev_ebitda" | "ev_sales" | "p_book"; label: string }> = [
    { key: "pe_ratio", label: "P/E" },
    { key: "ev_ebitda", label: "EV/EBITDA" },
    { key: "ev_sales", label: "EV/SALES" },
    { key: "p_book", label: "P/B" },
  ];
  const quart = (k: (typeof cols)[number]["key"]) =>
    finite(st[k].p25) && finite(st[k].p75) ? `${formatMultiple(st[k].p25)}–${formatMultiple(st[k].p75)}` : "—";
  const implied = [
    { label: "P/E", v: m.implied_valuations.pe_based, median: st.pe_ratio.median },
    { label: "EV/EBITDA", v: m.implied_valuations.ev_ebitda_based, median: st.ev_ebitda.median },
    { label: "EV/Sales", v: m.implied_valuations.ev_sales_based, median: st.ev_sales.median },
  ];
  const price = m.current_price;
  const source =
    m.peer_source === "custom" ? "your custom peer list" : m.peer_source === "static_fallback" ? "a curated fallback list" : "the provider's peer list, size-filtered (1%–100x market cap)";

  return (
    <View>
      <View style={s.table} wrap={false}>
        <View style={[s.tr, s.trHead]}>
          <Text style={[s.th, { width: "12%" }]}>TICKER</Text>
          <Text style={[s.th, { width: "36%" }]}>COMPANY</Text>
          {cols.map((c) => (
            <Text key={c.key} style={[s.th, { width: "13%", textAlign: "right" }]}>{c.label}</Text>
          ))}
        </View>
        <View style={[s.tr, { backgroundColor: C.signalSoft }]}>
          <Text style={[s.td, { width: "12%", fontFamily: "Plex Mono", fontWeight: 500 }]}>{symbol}</Text>
          <Text style={[s.td, { width: "36%" }]}>{truncate(name, 40) || "—"} <Text style={{ color: C.signal, fontSize: 6.5 }}>TARGET</Text></Text>
          {cols.map((c) => (
            <Text key={c.key} style={[s.num, { width: "13%" }]}>{formatMultiple((t[c.key] as number | null | undefined) ?? null)}</Text>
          ))}
        </View>
        {peers.map((p) => (
          <View key={p.ticker || p.symbol} style={s.tr}>
            <Text style={[s.td, { width: "12%", fontFamily: "Plex Mono" }]}>{p.ticker || p.symbol}</Text>
            <Text style={[s.td, { width: "36%" }, s.muted]}>{truncate(p.name, 44) || "—"}</Text>
            {cols.map((c) => (
              <Text key={c.key} style={[s.num, { width: "13%" }]}>{formatMultiple(p[c.key])}</Text>
            ))}
          </View>
        ))}
        <View style={[s.tr, s.trStrong]}>
          <Text style={[s.td, { width: "48%", fontWeight: 600 }]}>Peer median</Text>
          {cols.map((c) => (
            <Text key={c.key} style={[s.num, { width: "13%", fontWeight: 500 }]}>{formatMultiple(st[c.key].median)}</Text>
          ))}
        </View>
        <View style={s.tr}>
          <Text style={[s.td, { width: "48%" }, s.muted]}>Interquartile range</Text>
          {cols.map((c) => (
            <Text key={c.key} style={[s.num, { width: "13%" }, s.muted]}>{quart(c.key)}</Text>
          ))}
        </View>
      </View>

      <Text style={s.subhead}>Implied value per share</Text>
      <View style={{ flexDirection: "row", marginBottom: 10 }} wrap={false}>
        {implied.map((x, i) => {
          const v = x.v?.implied_per_share ?? null;
          const delta = finite(v) && v > 0 && finite(price) && price > 0 ? v / price - 1 : null;
          const lo = x.v?.implied_per_share_low;
          const hi = x.v?.implied_per_share_high;
          return (
            <View key={x.label} style={[s.card, { flex: 1, marginRight: i < 2 ? 8 : 0 }]}>
              <Text style={s.eyebrow}>{x.label} based</Text>
              <Text style={[s.kpiValue, { fontSize: 15 }]}>{formatCurrency(v, 2, currency)}</Text>
              <Text style={[s.kpiNote, { color: toneColor(delta) }]}>{delta != null ? `${formatPercent(delta)} vs market` : v != null && v <= 0 ? "Not meaningful" : "Unavailable"}</Text>
              <Text style={[s.small, { marginTop: 4 }]}>
                Median {formatMultiple(x.median)}
                {finite(lo) && finite(hi) ? ` · range ${formatCurrency(lo, 0, currency)}–${formatCurrency(hi, 0, currency)}` : ""}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={s.small}>
        Peers from {source}. Multiples are {m.period_basis ? printable(m.period_basis) : "trailing twelve months where available"}; negative or zero
        multiples are shown as NM and excluded from medians and quartiles.
      </Text>
      {m.warnings && m.warnings.length > 0 ? (
        <View style={{ marginTop: 8 }}>
          <Bullets items={m.warnings} color={C.ink3} />
        </View>
      ) : null}
    </View>
  );
}

// ---------------- Document ----------------

interface ValuationPDFProps {
  valuation: FullValuation;
  historical?: HistoricalFinancials | null;
  reverseDcf?: ReverseDCFResult | null;
  sensitivity?: SensitivityTable | null;
  multiples?: MultiplesResult | null;
}

function fieldRows(v: FullValuation, m: MultiplesResult | null): FieldRow[] {
  const isDDM = v.primary_model === "ddm";
  const model = isDDM ? v.ddm : v.dcf;
  const rows: FieldRow[] = [];
  if (finite(model?.per_share_value)) {
    const a = model.assumptions_used as { per_share_low?: number | null; per_share_high?: number | null };
    rows.push({
      label: isDDM ? "DDM" : "DCF",
      sub: isDDM ? "point estimate" : "±1% WACC, ±0.5% g",
      base: model.per_share_value,
      low: a.per_share_low ?? null,
      high: a.per_share_high ?? null,
      emphasis: true,
    });
  }
  const iv = m?.implied_valuations;
  for (const [label, x] of [
    ["P/E", iv?.pe_based],
    ["EV/EBITDA", iv?.ev_ebitda_based],
    ["EV/Sales", iv?.ev_sales_based],
  ] as const) {
    if (finite(x?.implied_per_share)) {
      rows.push({ label, sub: "peer quartiles", base: x.implied_per_share, low: x.implied_per_share_low ?? null, high: x.implied_per_share_high ?? null });
    }
  }
  return rows;
}

function headline(model: string, value: number | null, price: number | null, currency?: string | null): string {
  if (!finite(value)) return `The ${model} could not produce a value for this company — see the notices below.`;
  if (value <= 0) return `The ${model} base case is not positive (${formatCurrency(value, 2, currency)} per share), so it is not a meaningful anchor here.`;
  if (!finite(price) || price <= 0) return `The ${model} base case implies ${formatCurrency(value, 2, currency)} per share.`;
  const d = value / price - 1;
  const dir = Math.abs(d) < 0.005 ? "in line with" : d > 0 ? `${formatRate(Math.abs(d), 1)} above` : `${formatRate(Math.abs(d), 1)} below`;
  return `The ${model} base case implies ${formatCurrency(value, 2, currency)} per share, ${dir} the market price of ${formatCurrency(price, 2, currency)}.`;
}

function fetchedAt(unix: number | null | undefined): string {
  if (!finite(unix)) return "—";
  const d = new Date(unix * 1000);
  return Number.isNaN(d.getTime()) ? "—" : `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function ValuationPDF({ valuation, historical, reverseDcf, sensitivity, multiples }: ValuationPDFProps) {
  const { profile, dcf, ddm } = valuation;
  const isDDM = valuation.primary_model === "ddm";
  const model = isDDM ? ddm : dcf;
  const modelName = isDDM ? "DDM" : "DCF";
  const currency = profile.currency;
  const m = multiples ?? valuation.multiples;
  const price = profile.price ?? model?.current_price ?? null;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const rows = fieldRows(valuation, m);
  const positive = rows.flatMap((r) => [r.low ?? r.base, r.high ?? r.base]).filter((v) => finite(v) && v > 0);
  const range = positive.length ? { lo: Math.min(...positive), hi: Math.max(...positive) } : null;
  const value = model?.per_share_value ?? null;
  const upside = finite(value) && value > 0 ? model?.upside_pct ?? null : null;
  const a = (model?.assumptions_used ?? {}) as { wacc?: number; cost_of_equity?: number; terminal_growth_rate?: number; income_date?: string | null; revenue_growth_rates?: number[] };
  const rate = isDDM ? a.cost_of_equity : a.wacc;
  const notices = [...(dcf?.sector_warning ? [dcf.sector_warning.message] : []), ...(valuation.notices ?? [])];
  if (profile.served_stale) notices.push("The provider was unavailable; the last cached quote was used.");
  const wb = model?.wacc_breakdown ?? null;
  const showMarket = !isDDM && !!dcf;
  const hist = historical?.historical ?? [];

  const contents = [
    "Valuation range",
    isDDM ? "Dividend discount model" : "Discounted cash flow",
    ...(showMarket ? ["Reverse DCF", "Sensitivity"] : []),
    ...(m ? ["Trading comparables"] : []),
    "Historical financials",
    "Company & sources",
  ];
  let n = 0;
  const idx = () => String(++n).padStart(2, "0");
  const meta = [profile.sector, profile.industry, profile.country].filter(Boolean).join(" · ");
  const chrome = (
    <>
      <Running symbol={profile.symbol} name={profile.name} date={date} />
      <Foot />
    </>
  );

  return (
    <Document title={`${profile.symbol} — Valuation report`} author="Valuation.io" subject="Equity valuation (educational)" creator="Valuation.io">
      {/* 1 · Summary */}
      <Page size="A4" style={s.page}>
        {chrome}
        <View style={s.idRow}>
          <Text style={[s.pill, s.pillSolid]}>{profile.symbol}</Text>
          {profile.exchange ? <Text style={[s.pill, s.pillOutline]}>{profile.exchange}</Text> : null}
          <Text style={[s.pill, s.pillOutline]}>{currency ?? "USD"}</Text>
        </View>
        <Text style={s.company}>{truncate(profile.name ?? profile.symbol, 80)}</Text>
        {meta ? <Text style={s.companyMeta}>{meta}</Text> : null}
        <Text style={s.headline}>{headline(modelName, value, price, currency)}</Text>

        <View style={s.strip} wrap={false}>
          <View style={[s.stripCell, s.stripFirst]}>
            <Text style={s.stripLabel}>Market price</Text>
            <Text style={s.stripValue}>{formatCurrency(price, 2, currency)}</Text>
            <Text style={s.stripNote}>may be delayed</Text>
          </View>
          <View style={[s.stripCell, s.stripPrimary]}>
            <Text style={s.stripLabel}>{modelName} value / share</Text>
            <Text style={[s.stripValue, finite(value) && value <= 0 ? { color: C.neg } : {}]}>{formatCurrency(value, 2, currency)}</Text>
            <Text style={s.stripNote}>base case</Text>
          </View>
          <View style={s.stripCell}>
            <Text style={s.stripLabel}>Upside / downside</Text>
            <Text style={[s.stripValue, { color: toneColor(upside) }]}>{finite(value) && value <= 0 ? "NM" : formatPercent(upside)}</Text>
            <Text style={s.stripNote}>vs market price</Text>
          </View>
          <View style={s.stripCell}>
            <Text style={s.stripLabel}>Range across methods</Text>
            <Text style={s.stripValue}>{range ? `${formatCurrency(range.lo, 0, currency)}–${formatCurrency(range.hi, 0, currency)}` : "—"}</Text>
            <Text style={s.stripNote}>{rows.length} method{rows.length === 1 ? "" : "s"}</Text>
          </View>
          <View style={s.stripCell}>
            <Text style={s.stripLabel}>{isDDM ? "Cost of equity" : "WACC"} · g</Text>
            <Text style={s.stripValue}>{formatRate(rate)} · {formatRate(a.terminal_growth_rate)}</Text>
            <Text style={s.stripNote}>CAPM, dated inputs</Text>
          </View>
        </View>

        <View style={s.section}>
          <SectionHead index={idx()} title="Valuation range" sub="Implied value per share by method against the market price. Bars are ranges; the tick is the base case." />
          <RangeField rows={rows} price={price} currency={currency} />
        </View>

        {notices.length > 0 ? (
          <View style={s.notice} wrap={false}>
            <Text style={s.noticeTitle}>Read before interpreting</Text>
            {notices.map((t, i) => (
              <Text key={i} style={s.noticeItem}>– {printable(t)}</Text>
            ))}
          </View>
        ) : null}

        <View wrap={false} style={{ marginBottom: 16 }}>
          <Text style={s.eyebrow}>In this report</Text>
          <Text style={[s.small, { marginTop: 4 }]}>
            {contents.map((t, i) => `${String(i + 1).padStart(2, "0")}  ${t}`).join("     ")}
          </Text>
        </View>

        <View style={[s.card, { borderColor: C.lineStrong }]} wrap={false}>
          <Text style={[s.eyebrow, { marginBottom: 4 }]}>Important</Text>
          <Text style={s.small}>
            Educational and informational use only — not investment advice or a recommendation to buy or sell any
            security. Values are produced by automated models from third-party data and auto-derived assumptions,
            which are starting points rather than conclusions. Recent IPOs, distressed issuers and companies with
            sparse statements can produce unreliable results. Verify source data and apply your own judgment. The full
            methodology is published on the Methodology page of the website.
          </Text>
        </View>
      </Page>

      {/* 2 · Model */}
      <Page size="A4" style={s.page}>
        {chrome}
        <SectionHead
          index={idx()}
          title={isDDM ? "Dividend discount model" : "Discounted cash flow"}
          sub={
            isDDM
              ? "Five years of dividends per share plus a Gordon-growth terminal value, discounted at the cost of equity."
              : "Five-year free cash flow to the firm plus a Gordon-growth terminal value, discounted at WACC."
          }
        />
        {isDDM && ddm ? (
          <DDMBlock ddm={ddm} currency={currency} />
        ) : dcf ? (
          <DCFBlock dcf={dcf} currency={currency} />
        ) : (
          <Text style={s.body}>The model returned no result for this company{notices.length ? " — see the notices on page 1" : ""}.</Text>
        )}
      </Page>

      {/* 3 · Market expectations & sensitivity (DCF only) */}
      {showMarket ? (
        <Page size="A4" style={s.page}>
          {chrome}
          <View style={s.section}>
            <SectionHead index={idx()} title="Reverse DCF" sub="The uniform five-year revenue growth the price already assumes, holding every other assumption fixed." />
            {reverseDcf ? (
              <View>
                <View style={s.kpis} wrap={false}>
                  <View style={s.kpi}>
                    <Text style={s.kpiLabel}>Market-implied growth</Text>
                    <Text style={[s.kpiValue, { color: C.signal }]}>{formatRate(reverseDcf.implied_growth_rate, 1)}</Text>
                    <Text style={s.kpiNote}>per year, Y1–Y5 · {reverseDcf.solver_status.replace(/_/g, " ")}</Text>
                  </View>
                  <View style={s.kpi}>
                    <Text style={s.kpiLabel}>Price solved for</Text>
                    <Text style={s.kpiValue}>{formatCurrency(reverseDcf.target_price, 2, currency)}</Text>
                    <Text style={s.kpiNote}>{finite(price) && Math.abs(reverseDcf.target_price - price) < 0.005 ? "market price" : "custom target"}</Text>
                  </View>
                  <View style={s.kpi}>
                    <Text style={s.kpiLabel}>Base-case growth</Text>
                    <Text style={s.kpiValue}>{formatRate(reverseDcf.base_assumptions_growth, 1)}</Text>
                    <Text style={s.kpiNote}>average of the DCF schedule</Text>
                  </View>
                  <View style={[s.kpi, s.kpiLast]}>
                    <Text style={s.kpiLabel}>Margin of safety</Text>
                    <Text style={[s.kpiValue, { color: toneColor(reverseDcf.margin_of_safety) }]}>{formatPercent(reverseDcf.margin_of_safety)}</Text>
                    <Text style={s.kpiNote}>base value vs price</Text>
                  </View>
                </View>
                <GrowthScale data={reverseDcf} baseY1={a.revenue_growth_rates?.[0] ?? null} />
                <View style={[s.card, { backgroundColor: C.inset, borderWidth: 0 }]} wrap={false}>
                  <Text style={[s.eyebrow, { marginBottom: 3 }]}>Interpretation</Text>
                  <Text style={s.body}>{printable(reverseDcf.interpretation)}</Text>
                </View>
              </View>
            ) : (
              <Text style={s.body}>The reverse DCF was not available when this report was generated.</Text>
            )}
          </View>

          <View style={s.section}>
            <SectionHead index={idx()} title="Sensitivity" sub="Value per share across discount-rate and terminal-growth assumptions, centred on the base case. Shading compares each value with the market price." />
            {sensitivity ? (
              <>
                <SensitivityGrid data={sensitivity} currency={currency} />
                <Text style={[s.small, { marginTop: 6 }]}>
                  Steps of ±1 percentage point in WACC and ±0.5 point in terminal growth. Cells where WACC does not exceed growth are undefined (n/a).
                </Text>
              </>
            ) : (
              <Text style={s.body}>The sensitivity grid was not available when this report was generated.</Text>
            )}
          </View>
        </Page>
      ) : null}

      {/* 4 · Comparables */}
      {m ? (
        <Page size="A4" style={s.page}>
          {chrome}
          <SectionHead index={idx()} title="Trading comparables" sub="Peer median multiples applied to the company's own metrics." />
          <Comparables m={m} symbol={profile.symbol} name={profile.name} currency={currency} />
        </Page>
      ) : null}

      {/* 5 · History, company & sources */}
      <Page size="A4" style={s.page}>
        {chrome}
        <View style={s.section}>
          <SectionHead index={idx()} title="Historical financials" sub="Reported annual figures — the base the projection starts from. Missing line items are left blank, never zero." />
          {hist.length > 0 ? (
            <>
              <HistoryChart data={hist} currency={historical?.currency ?? currency} />
              <View style={s.table} wrap={false}>
                <View style={[s.tr, s.trHead]}>
                  <Text style={[s.th, { width: "28%" }]}>{historical?.currency ?? currency ?? "USD"}</Text>
                  {[...hist].sort((x, y) => x.year - y.year).map((r) => (
                    <Text key={r.year} style={[s.th, { flex: 1, textAlign: "right" }]}>{r.year}</Text>
                  ))}
                </View>
                {(
                  [
                    ["Revenue", "revenue"],
                    ["EBITDA", "ebitda"],
                    ["Operating income", "operating_income"],
                    ["Net income", "net_income"],
                  ] as const
                ).map(([label, key]) => (
                  <View key={key} style={s.tr}>
                    <Text style={[s.td, { width: "28%" }]}>{label}</Text>
                    {[...hist].sort((x, y) => x.year - y.year).map((r) => (
                      <Text key={r.year} style={[s.num, { flex: 1 }]}>{abbreviateNumber(r[key], historical?.currency ?? currency, 2)}</Text>
                    ))}
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={s.body}>Historical figures were not available when this report was generated.</Text>
          )}
        </View>

        <View style={s.section}>
          <SectionHead index={idx()} title="Company & sources" />
          <View style={s.split}>
            <View style={[s.splitCol, { flex: 1.25 }]}>
              <Text style={s.subhead}>Business</Text>
              <Text style={s.body}>{profile.description ? truncate(profile.description, 900) : "No description provided."}</Text>
            </View>
            <View style={s.splitGap} />
            <View style={s.splitCol} wrap={false}>
              <Text style={s.subhead}>Key facts</Text>
              <KV label="Market cap" value={abbreviateNumber(profile.market_cap, currency, 2)} />
              <KV label="Shares outstanding" value={finite(profile.shares_outstanding) ? `${(profile.shares_outstanding / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })}M` : "—"} />
              <KV label="P/E (TTM)" value={formatMultiple(profile.pe_ratio)} />
              <KV label="Beta" value={finite(profile.beta) ? profile.beta.toFixed(2) : "—"} />
              <KV label="Exchange" value={profile.exchange ?? "—"} />
            </View>
          </View>

          <View wrap={false}>
            <Text style={s.subhead}>Data and dates</Text>
            <KV label="Fundamentals, ratios, peers" value="Financial Modeling Prep" />
            <KV label="Quote fetched" value={fetchedAt(profile.data_as_of)} note={profile.served_stale ? "Cached copy — provider unavailable" : "Reused for up to one hour"} />
            <KV label="Latest annual statement" value={a.income_date ?? "—"} />
            {wb ? <KV label="Risk-free rate" value={formatRate(wb.risk_free_rate)} note={wb.rf_source} /> : null}
            {wb ? <KV label="Equity risk premium" value={formatRate(wb.equity_risk_premium)} note={wb.erp_source} /> : null}
            <KV label="Report generated" value={date} />
          </View>
        </View>

      </Page>
    </Document>
  );
}

