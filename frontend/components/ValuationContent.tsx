"use client";

import { useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { Async } from "@/lib/async";
import type {
  FullValuation,
  HistoricalFinancials,
  ImpliedValuation,
  MultiplesResult,
  ReverseDCFResult,
  SensitivityTable,
} from "@/types/valuation";
import { RangeChart, type RangeRow } from "@/components/charts/RangeChart";
import { CompanyProfileBlock } from "@/components/CompanyProfileBlock";
import { DCFCard } from "@/components/DCFCard";
import { DDMCard } from "@/components/DDMCard";
import { ExportPDFButton } from "@/components/ExportPDFButton";
import { HistoricalChart } from "@/components/HistoricalChart";
import { ModelDiagnostics } from "@/components/ModelDiagnostics";
import { MultiplesCard } from "@/components/MultiplesCard";
import { ReverseDCFCard } from "@/components/ReverseDCFCard";
import { SensitivityHeatmap } from "@/components/SensitivityHeatmap";
import { ValuationTickerHeader } from "@/components/ValuationTickerHeader";
import { ReportNav } from "@/components/report/ReportNav";
import { ReportSection } from "@/components/report/ReportSection";
import { SectionState } from "@/components/report/SectionState";
import { formatCurrency, formatPercent, formatRate, toneOf } from "@/lib/format";

interface ValuationContentProps {
  data: FullValuation;
  historical: Async<HistoricalFinancials>;
  sensitivity: Async<SensitivityTable>;
  reverseDcf: Async<ReverseDCFResult>;
}

function methodRows(data: FullValuation, multiples: MultiplesResult | null): RangeRow[] {
  const isDDM = data.primary_model === "ddm";
  const model = isDDM ? data.ddm : data.dcf;
  const rows: RangeRow[] = [];
  if (model?.per_share_value != null) {
    const a = model.assumptions_used as { per_share_low?: number | null; per_share_high?: number | null };
    rows.push({
      label: isDDM ? "DDM" : "DCF",
      sublabel: isDDM ? "point estimate" : "±1% WACC, ±0.5% g",
      base: model.per_share_value,
      low: a.per_share_low ?? null,
      high: a.per_share_high ?? null,
      emphasis: true,
    });
  }
  const iv = multiples?.implied_valuations;
  const peer = (label: string, v: ImpliedValuation | null) => {
    if (v?.implied_per_share == null) return;
    rows.push({
      label,
      sublabel: "peer quartiles",
      base: v.implied_per_share,
      low: v.implied_per_share_low ?? null,
      high: v.implied_per_share_high ?? null,
    });
  };
  if (iv) {
    peer("P/E", iv.pe_based);
    peer("EV/EBITDA", iv.ev_ebitda_based);
    peer("EV/Sales", iv.ev_sales_based);
  }
  return rows;
}

export function ValuationContent({ data, historical, sensitivity, reverseDcf }: ValuationContentProps) {
  const { profile, dcf, ddm } = data;
  const isDDM = data.primary_model === "ddm";
  const model = isDDM ? ddm : dcf;
  const currency = profile.currency;

  // Report-level interactive state; flows into the range chart and the PDF.
  const [activeMultiples, setActiveMultiples] = useState<MultiplesResult | null>(data.multiples);
  const [customReverse, setCustomReverse] = useState<ReverseDCFResult | null>(null);

  const rows = useMemo(() => methodRows(data, activeMultiples), [data, activeMultiples]);
  const price = profile.price ?? model?.current_price ?? null;

  const intrinsic = model?.per_share_value ?? null;
  const upsideMeaningful = intrinsic != null && intrinsic > 0;
  const upside = upsideMeaningful ? model?.upside_pct ?? null : null;

  const rangeValues = rows.flatMap((r) => [r.low ?? r.base, r.high ?? r.base]).filter(
    (v): v is number => v != null && Number.isFinite(v) && v > 0,
  );
  const range = rangeValues.length > 0 ? { low: Math.min(...rangeValues), high: Math.max(...rangeValues) } : null;

  const assumptions = (model?.assumptions_used ?? {}) as {
    wacc?: number;
    cost_of_equity?: number;
    terminal_growth_rate?: number;
  };
  const discountRate = isDDM ? assumptions.cost_of_equity : assumptions.wacc;

  const notices = [...(data.notices ?? [])];
  const sectorWarning = dcf?.sector_warning?.message;

  const sections = [
    { id: "range", label: "Range", show: true },
    { id: "model", label: isDDM ? "DDM" : "DCF", show: true },
    { id: "reverse", label: "Reverse DCF", show: !isDDM },
    { id: "sensitivity", label: "Sensitivity", show: !isDDM },
    { id: "history", label: "History", show: true },
    { id: "comps", label: "Comparables", show: true },
    { id: "diagnostics", label: "Diagnostics", show: true },
    { id: "company", label: "Company", show: true },
  ].filter((s) => s.show);
  const indexOf = (id: string) => String(sections.findIndex((s) => s.id === id) + 1).padStart(2, "0");

  const historicalData = historical.status === "ok" ? historical.data : null;
  const sensitivityData = sensitivity.status === "ok" ? sensitivity.data : null;
  const reverseData = reverseDcf.status === "ok" ? reverseDcf.data : null;

  return (
    <>
      <div className="container">
        <ValuationTickerHeader
          profile={profile}
          actions={
            <ExportPDFButton
              valuation={data}
              historical={historicalData}
              reverseDcf={customReverse ?? reverseData}
              sensitivity={sensitivityData}
              multiples={activeMultiples}
            />
          }
        />

        <dl className="summary-strip" aria-label="Valuation summary">
          <div className="summary-item">
            <dt>Market price</dt>
            <dd className="figure">{formatCurrency(price, 2, currency)}</dd>
            <span className="summary-note">{profile.exchange ?? "Exchange n/a"} · may be delayed</span>
          </div>
          <div className="summary-item summary-item-primary">
            <dt>{isDDM ? "DDM value" : "DCF value"} / share</dt>
            <dd className="figure">{formatCurrency(intrinsic, 2, currency)}</dd>
            <span className="summary-note">
              {intrinsic == null
                ? "Model unavailable — see notices"
                : intrinsic <= 0
                  ? "Non-positive: model not meaningful here"
                  : "Intrinsic estimate, base case"}
            </span>
          </div>
          <div className="summary-item">
            <dt>Upside / downside</dt>
            <dd className={`figure tone-${toneOf(upside)}`}>
              {intrinsic != null && intrinsic <= 0 ? "NM" : formatPercent(upside)}
            </dd>
            <span className="summary-note">vs market price</span>
          </div>
          <div className="summary-item">
            <dt>Range across methods</dt>
            <dd className="figure">
              {range ? `${formatCurrency(range.low, 0, currency)} – ${formatCurrency(range.high, 0, currency)}` : "—"}
            </dd>
            <span className="summary-note">
              {rows.length} method{rows.length === 1 ? "" : "s"}
              {rows.length > 0 && !range ? " · no positive values" : ""}
            </span>
          </div>
          <div className="summary-item">
            <dt>{isDDM ? "Cost of equity" : "WACC"} · terminal g</dt>
            <dd className="figure">
              {formatRate(discountRate)} <span className="summary-sep">·</span> {formatRate(assumptions.terminal_growth_rate)}
            </dd>
            <span className="summary-note">CAPM, Damodaran inputs</span>
          </div>
        </dl>

        {notices.length > 0 || sectorWarning ? (
          <div className="notice notice-warn report-notices" role="note">
            <TriangleAlert size={16} strokeWidth={1.8} aria-hidden="true" />
            <div>
              <span className="notice-title">Read before interpreting</span>
              <ul>
                {sectorWarning ? <li>{sectorWarning}</li> : null}
                {notices.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      <ReportNav sections={sections} />

      <div className="container report-body">
        <ReportSection
          id="range"
          index={indexOf("range")}
          title="Valuation range"
          subtitle="Implied value per share by method against the market price. Bars are ranges; the tick is the base case."
        >
          <RangeChart
            rows={rows}
            marker={price != null && price > 0 ? { value: price, label: "Market" } : null}
            format={(n, d) => formatCurrency(n, d, currency)}
            caption="Valuation range by method"
          />
        </ReportSection>

        <ReportSection
          id="model"
          index={indexOf("model")}
          title={isDDM ? "Dividend discount model" : "Discounted cash flow"}
          subtitle={
            isDDM
              ? "Five years of dividends per share plus a Gordon-growth terminal value, discounted at the cost of equity."
              : "Five-year free cash flow to the firm plus a Gordon-growth terminal value, discounted at WACC."
          }
        >
          {isDDM && ddm ? (
            <DDMCard ddm={ddm} currency={currency} />
          ) : dcf ? (
            <DCFCard dcf={dcf} currency={currency} />
          ) : (
            <SectionState
              state={{ status: "na", reason: notices.find((n) => /unavailable/i.test(n)) ?? "The model returned no result." }}
              label={isDDM ? "DDM" : "DCF"}
            />
          )}
        </ReportSection>

        {!isDDM ? (
          <ReportSection
            id="reverse"
            index={indexOf("reverse")}
            title="Reverse DCF"
            subtitle="The uniform five-year revenue growth the price already assumes, holding every other assumption fixed."
          >
            {reverseDcf.status === "ok" ? (
              <ReverseDCFCard
                ticker={profile.symbol}
                currency={currency}
                initialData={reverseDcf.data}
                onResultChange={setCustomReverse}
              />
            ) : (
              <SectionState state={reverseDcf} label="Reverse DCF" />
            )}
          </ReportSection>
        ) : null}

        {!isDDM ? (
          <ReportSection
            id="sensitivity"
            index={indexOf("sensitivity")}
            title="Sensitivity"
            subtitle="Value per share across discount-rate and terminal-growth assumptions, centred on the base case."
          >
            {sensitivity.status === "ok" ? (
              <SensitivityHeatmap data={sensitivity.data} currency={currency} />
            ) : (
              <SectionState state={sensitivity} label="Sensitivity" height={300} />
            )}
          </ReportSection>
        ) : null}

        <ReportSection
          id="history"
          index={indexOf("history")}
          title="Historical financials"
          subtitle="Reported annual figures — the base the projection starts from."
        >
          {historical.status === "ok" ? (
            <HistoricalChart data={historical.data.historical} currency={historical.data.currency ?? currency} />
          ) : (
            <SectionState state={historical} label="Historical financials" height={320} />
          )}
        </ReportSection>

        <ReportSection
          id="comps"
          index={indexOf("comps")}
          title="Trading comparables"
          subtitle="Peer median multiples applied to the company's own metrics."
        >
          {activeMultiples ? (
            <MultiplesCard multiples={activeMultiples} onPeersChange={setActiveMultiples} currency={currency} />
          ) : (
            <SectionState
              state={{ status: "na", reason: notices.find((n) => /comparables/i.test(n)) ?? "No comparable data." }}
              label="Trading comparables"
            />
          )}
        </ReportSection>

        <ReportSection
          id="diagnostics"
          index={indexOf("diagnostics")}
          title="Model diagnostics"
          subtitle="What to check before relying on the numbers above."
        >
          <ModelDiagnostics
            data={data}
            multiples={activeMultiples}
            historical={historical}
            sensitivity={sensitivity}
            reverseDcf={reverseDcf}
            methodCount={rows.length}
          />
        </ReportSection>

        <ReportSection id="company" index={indexOf("company")} title="Company profile">
          <CompanyProfileBlock profile={profile} />
        </ReportSection>

        <p className="report-disclaimer">
          Educational and informational use only — not investment advice or a recommendation to buy or sell any
          security. Auto-derived assumptions are starting points, not conclusions. Verify source data and apply
          your own judgment.
        </p>
      </div>
    </>
  );
}
