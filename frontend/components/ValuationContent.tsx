import type {
  FullValuation,
  HistoricalFinancials,
  SensitivityTable,
} from "@/types/valuation";
import { CompanyProfileBlock } from "@/components/CompanyProfileBlock";
import { DCFCard } from "@/components/DCFCard";
import { ExportPDFButton } from "@/components/ExportPDFButton";
import { FootballField, type FootballFieldMethod } from "@/components/FootballField";
import { HistoricalChart } from "@/components/HistoricalChart";
import { MultiplesCard } from "@/components/MultiplesCard";
import { SensitivityHeatmap } from "@/components/SensitivityHeatmap";
import { ValuationTickerHeader } from "@/components/ValuationTickerHeader";

interface ValuationContentProps {
  data: FullValuation;
  historical?: HistoricalFinancials | null;
  sensitivity?: SensitivityTable | null;
}

export function ValuationContent({
  data,
  historical,
  sensitivity,
}: ValuationContentProps) {
  const { profile, dcf, multiples } = data;
  const peers = multiples.peers_used;
  const peerLabel =
    peers.length > 0
      ? `${peers.length} peer${peers.length === 1 ? "" : "s"} · ${peers.join(", ")}`
      : "no peers available";

  const methods: FootballFieldMethod[] = [];

  // DCF range lives inside assumptions_used (typed as Any-ish by the schema),
  // so we narrow at the read site to pull per_share_low/per_share_high.
  const dcfAssumptions = dcf.assumptions_used as {
    per_share_low?: number | null;
    per_share_high?: number | null;
  };
  if (dcf.per_share_value != null) {
    methods.push({
      label: "DCF",
      base: dcf.per_share_value,
      low: dcfAssumptions.per_share_low ?? null,
      high: dcfAssumptions.per_share_high ?? null,
      color: "bull",
    });
  }

  // Comparables ranges sit next to implied_per_share on each method's object.
  // The shared ImpliedValuation type doesn't enumerate the range fields yet,
  // so cast at the read site to keep types/valuation.ts untouched.
  type RangedImplied = {
    implied_per_share: number | null;
    implied_per_share_low?: number | null;
    implied_per_share_high?: number | null;
  };
  const pe = multiples.implied_valuations.pe_based as RangedImplied | null;
  if (pe?.implied_per_share != null) {
    methods.push({
      label: "P/E",
      base: pe.implied_per_share,
      low: pe.implied_per_share_low ?? null,
      high: pe.implied_per_share_high ?? null,
      color: "accent",
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
      color: "cyan",
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
      color: "bear",
    });
  }

  const currentPrice = dcf.current_price ?? profile.price ?? null;

  const assumptions = dcf.assumptions_used as {
    wacc?: number;
    terminal_growth_rate?: number;
  };
  const wacc = assumptions.wacc;
  const tg = assumptions.terminal_growth_rate;
  const dcfSubtitle =
    wacc != null && tg != null
      ? `5-year projection · ${(wacc * 100).toFixed(2)}% WACC · ${(tg * 100).toFixed(2)}% terminal growth`
      : "5-year projection";

  const hasHistorical = !!historical && historical.historical.length > 0;

  return (
    <>
      <ValuationTickerHeader profile={profile} />

      <div className="export-pdf-row">
        <ExportPDFButton
          valuation={data}
          historical={historical}
          sensitivity={sensitivity}
        />
      </div>

      <div className="valuation-sections">
        <CompanyProfileBlock profile={profile} />

        <section className="valuation-section">
          <header className="section-header">
            <div className="section-title-group">
              <span className="section-num">01</span>
              <span className="section-title">Football Field</span>
            </div>
            <span className="section-subtitle">
              Valuation range across methods
            </span>
          </header>
          <FootballField currentPrice={currentPrice} methods={methods} />
        </section>

        <section className="valuation-section">
          <header className="section-header">
            <div className="section-title-group">
              <span className="section-num">02</span>
              <span className="section-title">Discounted Cash Flow</span>
            </div>
            <span className="section-subtitle">{dcfSubtitle}</span>
          </header>
          <DCFCard dcf={dcf} />
        </section>

        {hasHistorical ? (
          <section className="valuation-section">
            <header className="section-header">
              <div className="section-title-group">
                <span className="section-num">03</span>
                <span className="section-title">Historical Financials</span>
              </div>
              <span className="section-subtitle">
                Five-year trend of revenue, EBITDA, and net income — a sanity
                check before projecting forward.
              </span>
            </header>
            <HistoricalChart data={historical!.historical} />
          </section>
        ) : null}

        {sensitivity ? (
          <section className="valuation-section">
            <header className="section-header">
              <div className="section-title-group">
                <span className="section-num">04</span>
                <span className="section-title">Sensitivity Analysis</span>
              </div>
              <span className="section-subtitle">
                Per-share DCF value across a range of WACC and terminal growth
                assumptions. Green: implied value above current price. Red:
                below.
              </span>
            </header>
            <SensitivityHeatmap
              data={sensitivity}
              sectorWarning={dcf.sector_warning ?? null}
            />
          </section>
        ) : null}

        <section className="valuation-section">
          <header className="section-header">
            <div className="section-title-group">
              <span className="section-num">05</span>
              <span className="section-title">Trading Comparables</span>
            </div>
            <span className="section-subtitle">{peerLabel}</span>
          </header>
          <MultiplesCard multiples={multiples} />
        </section>
      </div>

      <div className="valuation-disclaimer">
        <p className="disclaimer-text">
          ⚠ This tool is for educational and informational purposes only.
          The outputs are not investment advice or a recommendation to buy
          or sell any security. Auto-derived assumptions are starting
          points, not conclusions. Always consult licensed financial
          professionals before making investment decisions.
        </p>
      </div>
    </>
  );
}
