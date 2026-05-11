import type {
  FullValuation,
  HistoricalFinancials,
  SensitivityTable,
} from "@/types/valuation";
import { CompanyProfileBlock } from "@/components/CompanyProfileBlock";
import { DCFCard } from "@/components/DCFCard";
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
  if (dcf.per_share_value != null) {
    methods.push({ label: "DCF", value: dcf.per_share_value, color: "bull" });
  }
  const pe = multiples.implied_valuations.pe_based;
  if (pe?.implied_per_share != null) {
    methods.push({ label: "P/E", value: pe.implied_per_share, color: "accent" });
  }
  const evEbitda = multiples.implied_valuations.ev_ebitda_based;
  if (evEbitda?.implied_per_share != null) {
    methods.push({
      label: "EV/EBITDA",
      value: evEbitda.implied_per_share,
      color: "indigo-light",
    });
  }
  const evSales = multiples.implied_valuations.ev_sales_based;
  if (evSales?.implied_per_share != null) {
    methods.push({
      label: "EV/Sales",
      value: evSales.implied_per_share,
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
            <SensitivityHeatmap data={sensitivity} />
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
    </>
  );
}
