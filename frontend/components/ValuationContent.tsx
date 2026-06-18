"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type {
  FullValuation,
  HistoricalFinancials,
  ReverseDCFResult,
  SensitivityTable,
} from "@/types/valuation";
import { BorderGlow } from "@/components/BorderGlow";
import { CompanyProfileBlock } from "@/components/CompanyProfileBlock";
import { DCFCard } from "@/components/DCFCard";
import { DDMCard } from "@/components/DDMCard";
import { ExportPDFButton } from "@/components/ExportPDFButton";
import { ModelDiagnostics } from "@/components/ModelDiagnostics";
import { MultiplesCard } from "@/components/MultiplesCard";
import { ReverseDCFCard } from "@/components/ReverseDCFCard";
import { ValuationTickerHeader } from "@/components/ValuationTickerHeader";
import { formatCurrency, formatPercent } from "@/lib/format";

// Lazy-load heavy chart components — Recharts + @react-pdf/renderer together
// add ~500KB+ to the initial bundle.
const FootballField = dynamic(
  () => import("@/components/FootballField").then((m) => ({ default: m.FootballField })),
  { ssr: false, loading: () => <div className="ff-container" /> },
);

const HistoricalChart = dynamic(
  () => import("@/components/HistoricalChart").then((m) => ({ default: m.HistoricalChart })),
  { ssr: false, loading: () => <div className="historical-chart-container" /> },
);

const SensitivityHeatmap = dynamic(
  () => import("@/components/SensitivityHeatmap").then((m) => ({ default: m.SensitivityHeatmap })),
  { ssr: false, loading: () => <div className="skeleton-card" style={{ height: 280 }} /> },
);

import type { FootballFieldMethod } from "@/components/FootballField";

interface ValuationContentProps {
  data: FullValuation;
  historical?: HistoricalFinancials | null;
  reverseDcf?: ReverseDCFResult | null;
  sensitivity?: SensitivityTable | null;
}

export function ValuationContent({
  data,
  historical,
  reverseDcf,
  sensitivity,
}: ValuationContentProps) {
  const { profile, dcf, ddm, multiples, primary_model } = data;
  const isDDM = primary_model === "ddm" || !!ddm;
  const valuationModel = isDDM ? ddm : dcf;

  // Report-level state: custom reverse DCF target and peer overrides.
  // These flow down to interactive cards and back up to the PDF export.
  const [activeReverseDcf, setActiveReverseDcf] = useState<ReverseDCFResult | null>(
    reverseDcf ?? null,
  );
  const [activeMultiples, setActiveMultiples] = useState(multiples);
  
  const peers = multiples.peers_used;
  const peerLabel =
    peers.length > 0
      ? `${peers.length} peer${peers.length === 1 ? "" : "s"} · ${peers.join(", ")}`
      : "no peers available";

  const methods: FootballFieldMethod[] = [];

  // Use DDM or DCF valuation model
  if (valuationModel?.per_share_value != null) {
    // For DDM, assumptions_used might have different structure, but per_share_low/high pattern is same
    const assumptions = valuationModel.assumptions_used as {
      per_share_low?: number | null;
      per_share_high?: number | null;
    };
    methods.push({
      label: isDDM ? "DDM" : "DCF",
      base: valuationModel.per_share_value,
      low: assumptions.per_share_low ?? null,
      high: assumptions.per_share_high ?? null,
      color: "bull",
    });
  }

  const pe = multiples.implied_valuations.pe_based;
  if (pe?.implied_per_share != null) {
    methods.push({
      label: "P/E",
      base: pe.implied_per_share,
      low: pe.implied_per_share_low ?? null,
      high: pe.implied_per_share_high ?? null,
      color: "accent",
    });
  }
  const evEbitda = multiples.implied_valuations.ev_ebitda_based;
  if (evEbitda?.implied_per_share != null) {
    methods.push({
      label: "EV/EBITDA",
      base: evEbitda.implied_per_share,
      low: evEbitda.implied_per_share_low ?? null,
      high: evEbitda.implied_per_share_high ?? null,
      color: "cyan",
    });
  }
  const evSales = multiples.implied_valuations.ev_sales_based;
  if (evSales?.implied_per_share != null) {
    methods.push({
      label: "EV/Sales",
      base: evSales.implied_per_share,
      low: evSales.implied_per_share_low ?? null,
      high: evSales.implied_per_share_high ?? null,
      color: "bear",
    });
  }

  const currentPrice = valuationModel?.current_price ?? profile.price ?? null;

  const assumptions = valuationModel?.assumptions_used as {
    wacc?: number;
    cost_of_equity?: number;
    terminal_growth_rate?: number;
    dividend_growth_rate?: number;
  };
  
  const discountRate = isDDM ? assumptions.cost_of_equity : assumptions.wacc;
  const tg = assumptions.terminal_growth_rate;
  
  const modelSubtitle = isDDM
    ? discountRate != null && tg != null
      ? `Dividend projection · ${(discountRate * 100).toFixed(2)}% cost of equity · ${(tg * 100).toFixed(2)}% terminal growth`
      : "Dividend projection"
    : discountRate != null && tg != null
      ? `5-year projection · ${(discountRate * 100).toFixed(2)}% WACC · ${(tg * 100).toFixed(2)}% terminal growth`
      : "5-year projection";
  const fmtRate = (value: number | null | undefined) =>
    formatPercent(value).replace(/^\+/, "");

  const hasHistorical = !!historical && historical.historical.length > 0;
  const hasSensitivity = !!sensitivity;
  const historicalSectionNum = "04";
  const sensitivitySectionNum = hasHistorical ? "05" : "04";
  const multiplesSectionNum = String(
    4 + (hasHistorical ? 1 : 0) + (hasSensitivity ? 1 : 0),
  ).padStart(2, "0");
  const overviewCards = [
    {
      label: "Market price",
      value: formatCurrency(currentPrice),
      note: "Current quote",
    },
    {
      label: isDDM ? "DDM value" : "DCF value",
      value: formatCurrency(valuationModel?.per_share_value),
      note: "Intrinsic estimate",
    },
    {
      label: "Upside / downside",
      value: formatPercent(valuationModel?.upside_pct),
      note: "vs market price",
    },
    {
      label: "Model context",
      value: peers.length > 0 ? `${peers.length} peers` : "No peers",
      note:
        discountRate != null && tg != null
          ? `${fmtRate(discountRate)} ${isDDM ? "Re" : "WACC"} · ${fmtRate(tg)} terminal growth`
          : peerLabel,
    },
  ];

  return (
    <>
      <ValuationTickerHeader profile={profile} />

      <div className="valuation-overview">
        <div className="valuation-overview-grid" aria-label="Valuation summary">
          {overviewCards.map((card) => (
            <div key={card.label} className="valuation-overview-card">
              <span className="valuation-overview-label">{card.label}</span>
              <strong className="valuation-overview-value">{card.value}</strong>
              <span className="valuation-overview-note">{card.note}</span>
            </div>
          ))}
        </div>
      </div>

      <ModelDiagnostics
        data={data}
        historical={historical}
        reverseDcf={reverseDcf}
        sensitivity={sensitivity}
        methodCount={methods.length}
      />

      <div className="export-pdf-row">
        <div className="export-pdf-copy">
          <span>Export</span>
          <p>Core PDF: summary, valuation model, Reverse DCF, and comparables.</p>
        </div>
        <ExportPDFButton
          valuation={data}
          historical={historical}
          reverseDcf={activeReverseDcf ?? reverseDcf}
          sensitivity={sensitivity}
          multiples={activeMultiples}
        />
      </div>

      <div className="valuation-sections">
        <BorderGlow className="report-glow-card valuation-section-glow" fillOpacity={0.1}>
          <CompanyProfileBlock profile={profile} />
        </BorderGlow>

        <BorderGlow className="report-glow-card valuation-section-glow" fillOpacity={0.1}>
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
        </BorderGlow>

        <BorderGlow className="report-glow-card valuation-section-glow" fillOpacity={0.1}>
          <section className="valuation-section">
            <header className="section-header">
              <div className="section-title-group">
                <span className="section-num">02</span>
                <span className="section-title">
                  {isDDM ? "Dividend Discount Model" : "Discounted Cash Flow"}
                </span>
              </div>
              <span className="section-subtitle">{modelSubtitle}</span>
            </header>
            {isDDM && ddm ? <DDMCard ddm={ddm} /> : dcf ? <DCFCard dcf={dcf} /> : null}
          </section>
        </BorderGlow>

        <BorderGlow className="report-glow-card valuation-section-glow" fillOpacity={0.1}>
          <section className="valuation-section">
            <header className="section-header">
              <div className="section-title-group">
                <span className="section-num">03</span>
                <span className="section-title">Reverse DCF</span>
              </div>
              <span className="section-subtitle">
                What growth rate does the market imply at the current price?
              </span>
            </header>
            <ReverseDCFCard
              ticker={profile.symbol}
              currentPrice={currentPrice}
              initialData={activeReverseDcf ?? reverseDcf}
              onResultChange={setActiveReverseDcf}
            />
          </section>
        </BorderGlow>

        {hasHistorical ? (
          <BorderGlow className="report-glow-card valuation-section-glow" fillOpacity={0.1}>
            <section className="valuation-section">
              <header className="section-header">
                <div className="section-title-group">
                  <span className="section-num">{historicalSectionNum}</span>
                  <span className="section-title">Historical Financials</span>
                </div>
                <span className="section-subtitle">
                  Five-year trend of revenue, EBITDA, and net income — a sanity
                  check before projecting forward.
                </span>
              </header>
              <HistoricalChart data={historical!.historical} />
            </section>
          </BorderGlow>
        ) : null}

        {sensitivity ? (
          <BorderGlow className="report-glow-card valuation-section-glow" fillOpacity={0.1}>
            <section className="valuation-section">
              <header className="section-header">
                <div className="section-title-group">
                  <span className="section-num">{sensitivitySectionNum}</span>
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
                sectorWarning={(dcf?.sector_warning || ddm) ? null : null}
              />
            </section>
          </BorderGlow>
        ) : null}

        <BorderGlow className="report-glow-card valuation-section-glow" fillOpacity={0.1}>
          <section className="valuation-section">
            <header className="section-header">
              <div className="section-title-group">
                <span className="section-num">{multiplesSectionNum}</span>
                <span className="section-title">Trading Comparables</span>
              </div>
              <span className="section-subtitle">{peerLabel}</span>
            </header>
            <MultiplesCard
              multiples={activeMultiples}
              onPeersChange={setActiveMultiples}
            />
          </section>
        </BorderGlow>
      </div>

      <BorderGlow className="report-glow-card disclaimer-glow" fillOpacity={0.1}>
        <div className="valuation-disclaimer">
          <p className="disclaimer-text">
            Important: this tool is for educational and informational purposes only.
            The outputs are not investment advice or a recommendation to buy
            or sell any security. Auto-derived assumptions are starting
            points, not conclusions. Always consult licensed financial
            professionals before making investment decisions.
          </p>
        </div>
      </BorderGlow>
    </>
  );
}
