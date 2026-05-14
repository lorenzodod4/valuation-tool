import {
  Circle,
  Document,
  Font,
  Line as PdfLine,
  Page,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import type {
  FullValuation,
  HistoricalFinancials,
  SensitivityTable,
  WACCBreakdown,
} from "@/types/valuation";

// Disable hyphenation — looks better for dense financial copy.
Font.registerHyphenationCallback((word) => [word]);

// Palette — neutral, print-friendly. Mirrors the screen design but flat-white bg.
const COLORS = {
  text: "#1a1a1a",
  textSecondary: "#444444",
  textMuted: "#777777",
  textFaint: "#999999",
  border: "#E5E5E5",
  borderStrong: "#CCCCCC",
  accent: "#4F46E5",
  bull: "#16A34A",
  bear: "#DC2626",
  // Cyan-600 — slightly darker than the web's #06B6D4 for better print
  // contrast on white. Used for the EV/EBITDA football-field bar so it
  // stays clearly distinct from the indigo P/E bar.
  cyan: "#0891B2",
  warningBg: "#FEF3F2",
  warningText: "#991B1B",
  rowAlt: "#F5F5F5",
  targetRow: "#FFFBEB",
  targetText: "#92400E",
};

const styles = StyleSheet.create({
  // ============ Page chrome ============
  page: {
    backgroundColor: "#FFFFFF",
    padding: "32 36 56 36",
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLORS.text,
  },
  topStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  topStripLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  // Wrapper around LogoSmall — gives the mark a fixed slot with a 6pt gap to
  // the text on its right. @react-pdf doesn't reliably honor `gap`, so we
  // use marginRight on this wrapper instead.
  logoSlotSmall: {
    marginRight: 6,
  },
  topStripText: {
    fontSize: 9,
    color: COLORS.textFaint,
    letterSpacing: 1,
  },
  topStripDate: {
    fontSize: 9,
    color: COLORS.textFaint,
  },
  hairline: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    marginBottom: 24,
  },

  // ============ Title block (page 1) ============
  ticker: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
    marginBottom: 2,
  },
  companyName: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  industryLine: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginBottom: 16,
  },

  // ============ Metric cards (2x2 grid) ============
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
    marginBottom: 18,
  },
  metricCard: {
    width: "50%",
    paddingHorizontal: 6,
    marginBottom: 10,
  },
  metricInner: {
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: "10 12",
  },
  metricLabel: {
    fontSize: 8,
    color: COLORS.textFaint,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
  },

  // ============ Metric cards row of 4 (page 2) ============
  metricRow4: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: 18,
  },
  metricCard4: {
    width: "25%",
    paddingHorizontal: 4,
  },

  // ============ Section headings ============
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginBottom: 10,
  },
  bigSectionTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
    marginBottom: 16,
  },

  // ============ Body text ============
  body: {
    fontSize: 9,
    lineHeight: 1.5,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },

  // ============ Football field bars ============
  ffRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    height: 22,
  },
  ffLabel: {
    width: 70,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
  },
  ffTrack: {
    flex: 1,
    height: 16,
    backgroundColor: "#FAFAFA",
    borderWidth: 0.5,
    borderColor: COLORS.border,
    position: "relative",
    marginRight: 8,
  },
  ffBar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: COLORS.accent,
  },
  ffCurrentPriceLine: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 1,
    backgroundColor: COLORS.text,
  },
  // Base-value tick drawn on top of the range bar. White interior + thin dark
  // border keeps it crisp on any bar color in print. Centered via a -1pt
  // marginLeft on the absolute-positioned element (width 2pt).
  ffBaseMarker: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 2,
    marginLeft: -1,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.5,
    borderColor: COLORS.text,
  },
  ffValueLabel: {
    width: 56,
    fontSize: 9,
    textAlign: "right",
    color: COLORS.text,
  },

  // ============ Tables (DCF projections, peers, etc.) ============
  table: {
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.rowAlt,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  tableRowHighlight: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.targetRow,
  },
  tableRowBold: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderStrong,
    backgroundColor: COLORS.rowAlt,
  },
  th: {
    padding: "6 8",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },
  td: {
    padding: "6 8",
    fontSize: 9,
    color: COLORS.text,
  },
  tdRight: {
    padding: "6 8",
    fontSize: 9,
    color: COLORS.text,
    textAlign: "right",
  },
  tdBold: {
    padding: "6 8",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
    textAlign: "right",
  },

  // ============ Assumptions grid ============
  kvGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 18,
  },
  kvCell: {
    width: "50%",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: "5 10 5 0",
  },
  kvLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  kvValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
  },

  // ============ WACC breakdown ============
  waccHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 6,
  },
  waccSource: {
    fontSize: 8,
    fontStyle: "italic",
    color: COLORS.textMuted,
  },
  waccRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 0.25,
    borderBottomColor: COLORS.border,
  },
  waccRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.borderStrong,
  },
  waccRowLabel: {
    fontSize: 9,
    color: COLORS.textSecondary,
  },
  waccRowValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
  },
  waccRowValueAccent: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: COLORS.accent,
  },

  // ============ Sector warning ============
  warning: {
    backgroundColor: COLORS.warningBg,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.bear,
    padding: 10,
    marginBottom: 14,
  },
  warningText: {
    fontSize: 9,
    fontStyle: "italic",
    color: COLORS.warningText,
    lineHeight: 1.4,
  },

  // ============ Implied valuations cards ============
  impliedGrid: {
    flexDirection: "row",
    marginHorizontal: -4,
    marginBottom: 18,
  },
  impliedCard: {
    width: "33.333%",
    paddingHorizontal: 4,
  },
  impliedInner: {
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 10,
  },
  impliedLabel: {
    fontSize: 8,
    color: COLORS.textFaint,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  impliedMultiple: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  impliedValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
    marginBottom: 2,
  },
  impliedDelta: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },

  // ============ Footer ============
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "center",
  },
  // Inner row inside footer — needed so we can put the logo and the text
  // side-by-side while the outer footer container keeps them centered.
  footerInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: COLORS.textFaint,
  },
  // Cover-page masthead row holding LogoLarge above the ticker.
  coverLogoRow: {
    marginBottom: 14,
  },
  // "Model Notes" block on the DCF page (informational warnings).
  modelNotes: {
    marginTop: 14,
  },
  modelNoteItem: {
    fontSize: 8.5,
    fontStyle: "italic",
    color: COLORS.textMuted,
    lineHeight: 1.4,
    marginBottom: 3,
  },

  // Small badge for target row in peer table.
  targetBadge: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: COLORS.targetText,
    letterSpacing: 0.5,
  },
});

// ---------------- Formatting helpers (PDF-local) ----------------
// Standalone to avoid any DOM-dependent imports from @/lib/format.

function fmtMoney(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function fmtAbbrev(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(decimals)}%`;
}

function fmtPctSigned(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(decimals)}%`;
}

function fmtMultiple(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}x`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function truncate(s: string | null | undefined, max = 1500): string {
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

// ---------------- Logo marks ----------------

// Five-candle rising pattern: red, green, red, green, green. Used as a
// masthead on the cover page.
function LogoLarge({ size = 48 }: { size?: number } = {}) {
  // Native pixel grid is 48 × 44; pass `size` to scale the SVG canvas while
  // letting the library upscale the inner coordinates linearly.
  const aspect = 44 / 48;
  return (
    <Svg width={size} height={size * aspect} viewBox="0 0 48 44">
      {/* Candle 1 — red, lowest */}
      <PdfLine x1={4} y1={22} x2={4} y2={40} stroke="#DC2626" strokeWidth={1} />
      <Rect x={1} y={26} width={6} height={9} fill="#DC2626" />
      {/* Candle 2 — green */}
      <PdfLine x1={14} y1={17} x2={14} y2={36} stroke="#16A34A" strokeWidth={1} />
      <Rect x={11} y={22} width={6} height={10} fill="#16A34A" />
      {/* Candle 3 — red */}
      <PdfLine x1={24} y1={21} x2={24} y2={38} stroke="#DC2626" strokeWidth={1} />
      <Rect x={21} y={24} width={6} height={8} fill="#DC2626" />
      {/* Candle 4 — green */}
      <PdfLine x1={34} y1={11} x2={34} y2={32} stroke="#16A34A" strokeWidth={1} />
      <Rect x={31} y={15} width={6} height={12} fill="#16A34A" />
      {/* Candle 5 — green, highest */}
      <PdfLine x1={44} y1={6} x2={44} y2={26} stroke="#16A34A" strokeWidth={1} />
      <Rect x={41} y={10} width={6} height={12} fill="#16A34A" />
    </Svg>
  );
}

// Three-candle rising pattern inside a thin circle. Used in TopStrip + Footer
// chrome so the mark appears on every page.
function LogoSmall({ size = 16 }: { size?: number } = {}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Circle cx={8} cy={8} r={7.5} fill="none" stroke="#1a1a1a" strokeWidth={1} />
      {/* Candle 1 — red */}
      <PdfLine x1={5} y1={5} x2={5} y2={11} stroke="#DC2626" strokeWidth={0.8} />
      <Rect x={4} y={6.5} width={2} height={3} fill="#DC2626" />
      {/* Candle 2 — green */}
      <PdfLine x1={8} y1={4} x2={8} y2={10} stroke="#16A34A" strokeWidth={0.8} />
      <Rect x={7} y={5.5} width={2} height={3.5} fill="#16A34A" />
      {/* Candle 3 — green, highest */}
      <PdfLine x1={11} y1={3.5} x2={11} y2={8.5} stroke="#16A34A" strokeWidth={0.8} />
      <Rect x={10} y={4.5} width={2} height={3.5} fill="#16A34A" />
    </Svg>
  );
}

// ---------------- Sub-components ----------------

interface FooterProps {
  date: string;
}
function Footer({ date }: FooterProps) {
  return (
    <View style={styles.footer} fixed>
      <View style={styles.footerInner}>
        <View style={styles.logoSlotSmall}>
          <LogoSmall size={12} />
        </View>
        <Text style={styles.footerText}>
          Built by Lorenzo Dodero · valuation.io · {date}
        </Text>
      </View>
    </View>
  );
}

interface TopStripProps {
  date: string;
}
function TopStrip({ date }: TopStripProps) {
  return (
    <>
      <View style={styles.topStrip}>
        <View style={styles.topStripLeft}>
          <View style={styles.logoSlotSmall}>
            <LogoSmall size={12} />
          </View>
          <Text style={styles.topStripText}>VALUATION REPORT</Text>
        </View>
        <Text style={styles.topStripDate}>{date}</Text>
      </View>
      <View style={styles.hairline} />
    </>
  );
}

interface MetricProps {
  label: string;
  value: string;
}
function MetricCard({ label, value }: MetricProps) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricInner}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}
function MetricCard4({ label, value }: MetricProps) {
  return (
    <View style={styles.metricCard4}>
      <View style={styles.metricInner}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

interface FootballFieldBarProps {
  label: string;
  base: number;
  low: number | null;
  high: number | null;
  color: string;
  maxValue: number;
  currentPrice: number | null;
}
function FootballFieldBar({
  label,
  base,
  low,
  high,
  color,
  maxValue,
  currentPrice,
}: FootballFieldBarProps) {
  // Valid range = both bounds present, finite, and strictly ordered.
  const hasRange =
    low != null &&
    high != null &&
    Number.isFinite(low) &&
    Number.isFinite(high) &&
    high > low;

  // Bar geometry as percentages of the track width. For a range bar the
  // colored segment starts at `low` and spans `high − low`; for the degraded
  // single-point fallback it runs from 0 to `base` (same as before this
  // sprint) and we skip the base marker because the bar's right edge already
  // represents the value.
  const barLeftPct = hasRange
    ? Math.max(0, Math.min(100, ((low as number) / maxValue) * 100))
    : 0;
  const rawSpan = hasRange
    ? (((high as number) - (low as number)) / maxValue) * 100
    : (base / maxValue) * 100;
  const barWidthPct = Math.max(0, Math.min(100 - barLeftPct, rawSpan));

  const markerPct = hasRange
    ? Math.max(0, Math.min(100, (base / maxValue) * 100))
    : null;

  const cpPct =
    currentPrice != null && currentPrice > 0 && maxValue > 0
      ? Math.min(100, (currentPrice / maxValue) * 100)
      : null;

  return (
    <View style={styles.ffRow}>
      <Text style={styles.ffLabel}>{label}</Text>
      <View style={styles.ffTrack}>
        <View
          style={[
            styles.ffBar,
            {
              left: `${barLeftPct}%`,
              width: `${barWidthPct}%`,
              backgroundColor: color,
            },
          ]}
        />
        {markerPct != null ? (
          <View style={[styles.ffBaseMarker, { left: `${markerPct}%` }]} />
        ) : null}
        {cpPct != null ? (
          <View style={[styles.ffCurrentPriceLine, { left: `${cpPct}%` }]} />
        ) : null}
      </View>
      <Text style={styles.ffValueLabel}>{fmtMoney(base)}</Text>
    </View>
  );
}

// ---------------- Pages ----------------

interface ValuationPDFProps {
  valuation: FullValuation;
  historical?: HistoricalFinancials | null;
  sensitivity?: SensitivityTable | null;
}

function CoverPage({ valuation, today }: { valuation: FullValuation; today: string }) {
  const { profile, dcf, multiples } = valuation;

  // Range data lives inside dicts the shared types don't enumerate (the
  // backend serializes them as opaque dict[str, Any]). Cast at the read site
  // so types/valuation.ts can stay untouched. Same pattern as ValuationContent.
  type RangedImplied = {
    implied_per_share?: number | null;
    implied_per_share_low?: number | null;
    implied_per_share_high?: number | null;
  };
  const dcfAssumptions = dcf.assumptions_used as {
    per_share_low?: number | null;
    per_share_high?: number | null;
  };

  interface FFMethod {
    label: string;
    base: number;
    low: number | null;
    high: number | null;
    color: string;
  }

  // Assemble football-field methods. Colors mirror the web version's intent:
  // DCF = green (bull), P/E = indigo (accent), EV/EBITDA = cyan, EV/Sales =
  // red (bear). Cyan keeps EV/EBITDA distinct from the indigo P/E bar; red
  // doesn't collide with the current-price reference line (which uses
  // COLORS.text, not bear, in the PDF).
  const methods: FFMethod[] = [];
  if (dcf.per_share_value != null) {
    methods.push({
      label: "DCF",
      base: dcf.per_share_value,
      low: dcfAssumptions.per_share_low ?? null,
      high: dcfAssumptions.per_share_high ?? null,
      color: COLORS.bull,
    });
  }
  const pe = multiples.implied_valuations.pe_based as RangedImplied | null;
  if (pe?.implied_per_share != null) {
    methods.push({
      label: "P/E",
      base: pe.implied_per_share,
      low: pe.implied_per_share_low ?? null,
      high: pe.implied_per_share_high ?? null,
      color: COLORS.accent,
    });
  }
  const evEbitda = multiples.implied_valuations.ev_ebitda_based as
    | RangedImplied
    | null;
  if (evEbitda?.implied_per_share != null) {
    methods.push({
      label: "EV/EBITDA",
      base: evEbitda.implied_per_share,
      low: evEbitda.implied_per_share_low ?? null,
      high: evEbitda.implied_per_share_high ?? null,
      color: COLORS.cyan,
    });
  }
  const evSales = multiples.implied_valuations.ev_sales_based as
    | RangedImplied
    | null;
  if (evSales?.implied_per_share != null) {
    methods.push({
      label: "EV/Sales",
      base: evSales.implied_per_share,
      low: evSales.implied_per_share_low ?? null,
      high: evSales.implied_per_share_high ?? null,
      color: COLORS.bear,
    });
  }

  const currentPrice = dcf.current_price ?? profile.price ?? null;
  // Max value is the upper bound of the bar track; include every method's
  // high (so range bars don't get clipped on the right) plus the bases and
  // the current-price reference. Pad 10% above the largest so the longest
  // bar doesn't sit flush against the right edge.
  const maxCandidates: number[] = [];
  for (const m of methods) {
    if (Number.isFinite(m.base)) maxCandidates.push(m.base);
    if (m.low != null && Number.isFinite(m.low)) maxCandidates.push(m.low);
    if (m.high != null && Number.isFinite(m.high)) maxCandidates.push(m.high);
  }
  if (currentPrice != null && currentPrice > 0) maxCandidates.push(currentPrice);
  const seriesMax = maxCandidates.length > 0 ? Math.max(...maxCandidates) : 0;
  const maxValue = seriesMax > 0 ? seriesMax * 1.1 : 1;

  const industryLine = [profile.industry, profile.country]
    .filter(Boolean)
    .join(" · ");

  return (
    <Page size="A4" style={styles.page}>
      <TopStrip date={today} />

      <View style={styles.coverLogoRow}>
        <LogoLarge size={56} />
      </View>
      <Text style={styles.ticker}>{profile.symbol}</Text>
      {profile.name ? (
        <Text style={styles.companyName}>{profile.name}</Text>
      ) : null}
      {industryLine ? (
        <Text style={styles.industryLine}>{industryLine}</Text>
      ) : null}

      <View style={styles.metricGrid}>
        <MetricCard label="CURRENT PRICE" value={fmtMoney(profile.price)} />
        <MetricCard label="MARKET CAP" value={fmtAbbrev(profile.market_cap)} />
        <MetricCard
          label="P/E (TTM)"
          value={
            profile.pe_ratio != null && Number.isFinite(profile.pe_ratio)
              ? `${profile.pe_ratio.toFixed(1)}x`
              : "—"
          }
        />
        <MetricCard
          label="BETA"
          value={
            profile.beta != null && Number.isFinite(profile.beta)
              ? profile.beta.toFixed(3)
              : "—"
          }
        />
      </View>

      {profile.description ? (
        <>
          <Text style={styles.sectionTitle}>Business Description</Text>
          <Text style={styles.body}>{truncate(profile.description, 1500)}</Text>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Valuation Summary</Text>
      <Text style={styles.sectionSubtitle}>
        Implied per-share value across methods vs current market price
        {currentPrice != null ? ` (${fmtMoney(currentPrice)})` : ""}
      </Text>
      <View style={{ marginBottom: 14 }}>
        {methods.length === 0 ? (
          <Text style={styles.body}>No valuation methods available.</Text>
        ) : (
          methods.map((m) => (
            <FootballFieldBar
              key={m.label}
              label={m.label}
              base={m.base}
              low={m.low}
              high={m.high}
              color={m.color}
              maxValue={maxValue}
              currentPrice={currentPrice}
            />
          ))
        )}
      </View>

      {dcf.sector_warning ? (
        <View style={styles.warning}>
          <Text style={styles.warningText}>{dcf.sector_warning.message}</Text>
        </View>
      ) : null}

      <Footer date={today} />
    </Page>
  );
}

function DCFPage({
  valuation,
  today,
}: {
  valuation: FullValuation;
  today: string;
}) {
  const { dcf } = valuation;
  const assumptions = dcf.assumptions_used as {
    wacc?: number;
    terminal_growth_rate?: number;
    tax_rate?: number;
    ebit_margin?: number;
    da_pct_revenue?: number;
    capex_pct_revenue?: number;
    wc_change_pct_revenue?: number;
    historical_cagr_3y?: number;
  };

  const upside = dcf.upside_pct;
  const upsideText = fmtPctSigned(upside);

  const wb = dcf.wacc_breakdown ?? null;

  return (
    <Page size="A4" style={styles.page}>
      <TopStrip date={today} />

      <Text style={styles.bigSectionTitle}>Discounted Cash Flow</Text>

      <View style={styles.metricRow4}>
        <MetricCard4 label="DCF INTRINSIC" value={fmtMoney(dcf.per_share_value)} />
        <MetricCard4 label="MARKET PRICE" value={fmtMoney(dcf.current_price)} />
        <MetricCard4 label="UPSIDE / DOWNSIDE" value={upsideText} />
        <MetricCard4
          label="ENTERPRISE VALUE"
          value={fmtAbbrev(dcf.enterprise_value)}
        />
      </View>

      <Text style={styles.sectionTitle}>5-year Projections</Text>
      <View style={[styles.table, { marginBottom: 18 }]}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { width: "16%" }]}>YEAR</Text>
          <Text style={[styles.th, { width: "28%", textAlign: "right" }]}>
            REVENUE
          </Text>
          <Text style={[styles.th, { width: "28%", textAlign: "right" }]}>
            EBIT
          </Text>
          <Text style={[styles.th, { width: "28%", textAlign: "right" }]}>
            FCFF
          </Text>
        </View>
        {dcf.projections.map((p) => (
          <View key={p.year} style={styles.tableRow}>
            <Text style={[styles.td, { width: "16%" }]}>Y{p.year}</Text>
            <Text style={[styles.tdRight, { width: "28%" }]}>
              {fmtAbbrev(p.revenue)}
            </Text>
            <Text style={[styles.tdRight, { width: "28%" }]}>
              {fmtAbbrev(p.ebit)}
            </Text>
            <Text style={[styles.tdRight, { width: "28%" }]}>
              {fmtAbbrev(p.fcff)}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Assumptions</Text>
      <View style={styles.kvGrid}>
        <View style={styles.kvCell}>
          <Text style={styles.kvLabel}>WACC</Text>
          <Text style={styles.kvValue}>{fmtPct(assumptions.wacc)}</Text>
        </View>
        <View style={styles.kvCell}>
          <Text style={styles.kvLabel}>Terminal growth</Text>
          <Text style={styles.kvValue}>
            {fmtPct(assumptions.terminal_growth_rate)}
          </Text>
        </View>
        <View style={styles.kvCell}>
          <Text style={styles.kvLabel}>Tax rate</Text>
          <Text style={styles.kvValue}>{fmtPct(assumptions.tax_rate)}</Text>
        </View>
        <View style={styles.kvCell}>
          <Text style={styles.kvLabel}>Revenue CAGR (3Y)</Text>
          <Text style={styles.kvValue}>
            {fmtPct(assumptions.historical_cagr_3y)}
          </Text>
        </View>
        <View style={styles.kvCell}>
          <Text style={styles.kvLabel}>EBIT margin</Text>
          <Text style={styles.kvValue}>{fmtPct(assumptions.ebit_margin)}</Text>
        </View>
        <View style={styles.kvCell}>
          <Text style={styles.kvLabel}>D&A % revenue</Text>
          <Text style={styles.kvValue}>{fmtPct(assumptions.da_pct_revenue)}</Text>
        </View>
        <View style={styles.kvCell}>
          <Text style={styles.kvLabel}>CapEx % revenue</Text>
          <Text style={styles.kvValue}>
            {fmtPct(assumptions.capex_pct_revenue)}
          </Text>
        </View>
        <View style={styles.kvCell}>
          <Text style={styles.kvLabel}>WC change % revenue</Text>
          <Text style={styles.kvValue}>
            {fmtPct(assumptions.wc_change_pct_revenue)}
          </Text>
        </View>
      </View>

      {wb ? <WaccBlock wb={wb} /> : null}

      {/* Informational sanity-check notes from the model (anomalous margin,
          market divergence, ratio clamps, etc.). Understated — italic, muted
          — to distinguish from the red sector_warning banner on the cover. */}
      {dcf.warnings && dcf.warnings.length > 0 ? (
        <View style={styles.modelNotes} wrap>
          <Text style={styles.sectionTitle}>Model Notes</Text>
          {dcf.warnings.map((w, i) => (
            <Text key={i} style={styles.modelNoteItem}>
              — {w}
            </Text>
          ))}
        </View>
      ) : null}

      <Footer date={today} />
    </Page>
  );
}

function WaccBlock({ wb }: { wb: WACCBreakdown }) {
  return (
    <View>
      <View style={styles.waccHeader}>
        <Text style={styles.sectionTitle}>WACC Breakdown</Text>
        <Text style={styles.waccSource}>Source: Damodaran, Jan 2026</Text>
      </View>
      {[
        ["Risk-free rate", fmtPct(wb.risk_free_rate)],
        ["Equity risk premium", fmtPct(wb.equity_risk_premium)],
        ["Beta (β)", wb.beta.toFixed(3)],
        ["Cost of equity (Re)", fmtPct(wb.cost_of_equity)],
        ["Cost of debt pretax", fmtPct(wb.cost_of_debt_pretax)],
        ["Tax rate", fmtPct(wb.tax_rate)],
        ["Cost of debt after-tax", fmtPct(wb.cost_of_debt_aftertax)],
        ["Equity weight (E/V)", fmtPct(wb.weight_equity, 1)],
        ["Debt weight (D/V)", fmtPct(wb.weight_debt, 1)],
      ].map(([label, value]) => (
        <View key={label} style={styles.waccRow}>
          <Text style={styles.waccRowLabel}>{label}</Text>
          <Text style={styles.waccRowValue}>{value}</Text>
        </View>
      ))}
      <View style={styles.waccRowFinal}>
        <Text style={styles.waccRowLabel}>WACC</Text>
        <Text style={styles.waccRowValueAccent}>{fmtPct(wb.wacc)}</Text>
      </View>
    </View>
  );
}

function PeersPage({
  valuation,
  today,
}: {
  valuation: FullValuation;
  today: string;
}) {
  const { profile, multiples } = valuation;
  const target = multiples.target_metrics;
  const peers = multiples.peer_statistics.peers ?? [];
  const stats = multiples.peer_statistics.statistics;
  const currentPrice = multiples.current_price;

  function deltaPct(implied: number | null | undefined): number | null {
    if (implied == null || currentPrice == null || currentPrice <= 0) return null;
    return (implied - currentPrice) / currentPrice;
  }

  function deltaColor(delta: number | null): string {
    if (delta == null) return COLORS.text;
    return delta >= 0 ? COLORS.bull : COLORS.bear;
  }

  const peBased = multiples.implied_valuations.pe_based;
  const evEbBased = multiples.implied_valuations.ev_ebitda_based;
  const evSlBased = multiples.implied_valuations.ev_sales_based;

  // Column widths sum to 100%.
  const cols = {
    ticker: "11%",
    name: "33%",
    pe: "14%",
    ev_ebitda: "14%",
    ev_sales: "14%",
    pbook: "14%",
  };

  return (
    <Page size="A4" style={styles.page}>
      <TopStrip date={today} />

      <Text style={styles.bigSectionTitle}>Trading Comparables</Text>

      <Text style={styles.sectionTitle}>Peer Multiples</Text>
      <View style={[styles.table, { marginBottom: 18 }]}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { width: cols.ticker }]}>TICKER</Text>
          <Text style={[styles.th, { width: cols.name }]}>COMPANY</Text>
          <Text style={[styles.th, { width: cols.pe, textAlign: "right" }]}>
            P/E
          </Text>
          <Text
            style={[styles.th, { width: cols.ev_ebitda, textAlign: "right" }]}
          >
            EV/EBITDA
          </Text>
          <Text
            style={[styles.th, { width: cols.ev_sales, textAlign: "right" }]}
          >
            EV/SALES
          </Text>
          <Text style={[styles.th, { width: cols.pbook, textAlign: "right" }]}>
            P/B
          </Text>
        </View>

        {/* Target row highlighted */}
        <View style={styles.tableRowHighlight}>
          <Text style={[styles.td, { width: cols.ticker }]}>
            {profile.symbol}{" "}
            <Text style={styles.targetBadge}>TARGET</Text>
          </Text>
          <Text style={[styles.td, { width: cols.name }]}>
            {profile.name || "—"}
          </Text>
          <Text style={[styles.tdRight, { width: cols.pe }]}>
            {fmtMultiple(
              (target.pe_ratio as number | null | undefined) ?? null,
            )}
          </Text>
          <Text style={[styles.tdRight, { width: cols.ev_ebitda }]}>
            {fmtMultiple(
              (target.ev_ebitda as number | null | undefined) ?? null,
            )}
          </Text>
          <Text style={[styles.tdRight, { width: cols.ev_sales }]}>
            {fmtMultiple(
              (target.ev_sales as number | null | undefined) ?? null,
            )}
          </Text>
          <Text style={[styles.tdRight, { width: cols.pbook }]}>
            {fmtMultiple(
              (target.p_book as number | null | undefined) ?? null,
            )}
          </Text>
        </View>

        {peers.map((peer) => (
          <View key={peer.ticker || peer.symbol} style={styles.tableRow}>
            <Text style={[styles.td, { width: cols.ticker }]}>
              {peer.ticker || peer.symbol}
            </Text>
            <Text style={[styles.td, { width: cols.name }]}>
              {peer.name || "—"}
            </Text>
            <Text style={[styles.tdRight, { width: cols.pe }]}>
              {fmtMultiple(peer.pe_ratio)}
            </Text>
            <Text style={[styles.tdRight, { width: cols.ev_ebitda }]}>
              {fmtMultiple(peer.ev_ebitda)}
            </Text>
            <Text style={[styles.tdRight, { width: cols.ev_sales }]}>
              {fmtMultiple(peer.ev_sales)}
            </Text>
            <Text style={[styles.tdRight, { width: cols.pbook }]}>
              {fmtMultiple(peer.p_book)}
            </Text>
          </View>
        ))}

        {/* Median row */}
        <View style={styles.tableRowBold}>
          <Text style={[styles.tdBold, { width: cols.ticker, textAlign: "left" }]}>
            MEDIAN
          </Text>
          <Text style={[styles.td, { width: cols.name }]}> </Text>
          <Text style={[styles.tdBold, { width: cols.pe }]}>
            {fmtMultiple(stats.pe_ratio.median)}
          </Text>
          <Text style={[styles.tdBold, { width: cols.ev_ebitda }]}>
            {fmtMultiple(stats.ev_ebitda.median)}
          </Text>
          <Text style={[styles.tdBold, { width: cols.ev_sales }]}>
            {fmtMultiple(stats.ev_sales.median)}
          </Text>
          <Text style={[styles.tdBold, { width: cols.pbook }]}>
            {fmtMultiple(stats.p_book.median)}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Implied Valuations</Text>
      <View style={styles.impliedGrid}>
        {[
          {
            label: "P/E BASED",
            multiple: stats.pe_ratio.median,
            implied: peBased?.implied_per_share ?? null,
          },
          {
            label: "EV/EBITDA BASED",
            multiple: stats.ev_ebitda.median,
            implied: evEbBased?.implied_per_share ?? null,
          },
          {
            label: "EV/SALES BASED",
            multiple: stats.ev_sales.median,
            implied: evSlBased?.implied_per_share ?? null,
          },
        ].map((card) => {
          const delta = deltaPct(card.implied);
          return (
            <View key={card.label} style={styles.impliedCard}>
              <View style={styles.impliedInner}>
                <Text style={styles.impliedLabel}>{card.label}</Text>
                <Text style={styles.impliedMultiple}>
                  {fmtMultiple(card.multiple)} (peer median)
                </Text>
                <Text style={styles.impliedValue}>
                  {fmtMoney(card.implied)}
                </Text>
                <Text style={[styles.impliedDelta, { color: deltaColor(delta) }]}>
                  {fmtPctSigned(delta)} vs current
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <Text style={[styles.body, { fontStyle: "italic", marginTop: 6 }]}>
        Peers sourced from FMP, size-filtered between 1% and 100× of target
        market cap. Implied valuations apply peer median multiples to target
        metrics.
      </Text>

      <Footer date={today} />
    </Page>
  );
}

// ---------------- Root Document ----------------

export function ValuationPDF({ valuation }: ValuationPDFProps) {
  const today = fmtDate(new Date());
  return (
    <Document
      title={`${valuation.profile.symbol} Valuation Report`}
      author="valuation.io"
    >
      <CoverPage valuation={valuation} today={today} />
      <DCFPage valuation={valuation} today={today} />
      <PeersPage valuation={valuation} today={today} />
    </Document>
  );
}
