import {
  Activity,
  Database,
  Gauge,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import type {
  FullValuation,
  HistoricalFinancials,
  ReverseDCFResult,
  SensitivityTable,
} from "@/types/valuation";
import { formatPercent } from "@/lib/format";

function dataAgeDays(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;
  const asOf = new Date(dateStr);
  if (Number.isNaN(asOf.getTime())) return null;
  return Math.floor((Date.now() - asOf.getTime()) / (1000 * 60 * 60 * 24));
}

interface ModelDiagnosticsProps {
  data: FullValuation;
  historical?: HistoricalFinancials | null;
  reverseDcf?: ReverseDCFResult | null;
  sensitivity?: SensitivityTable | null;
  methodCount: number;
}

type DiagnosticTone = "ok" | "watch" | "risk";

interface DiagnosticItem {
  label: string;
  value: string;
  note: string;
  tone: DiagnosticTone;
  icon: LucideIcon;
}

function pct(n: number | null | undefined): string {
  return formatPercent(n).replace(/^\+/, "");
}

function isWaccDataStale(dataAsOf: string | undefined | null): boolean {
  if (!dataAsOf) return false;
  const asOf = new Date(dataAsOf);
  if (Number.isNaN(asOf.getTime())) return false;
  const days = (Date.now() - asOf.getTime()) / (1000 * 60 * 60 * 24);
  return days > 180;
}

export function ModelDiagnostics({
  data,
  historical,
  reverseDcf,
  sensitivity,
  methodCount,
}: ModelDiagnosticsProps) {
  const { dcf, ddm, multiples } = data;
  const valuationModel = dcf ?? ddm;
  const warningCount =
    (valuationModel?.warnings.length ?? 0) +
    (dcf?.sector_warning ? 1 : 0) +
    (multiples.warnings?.length ?? 0);
  const skippedPeers = multiples.peer_statistics.skipped_peers?.length ?? 0;
  const validPeers = multiples.peers_used.length;
  const tvExposure =
    dcf && dcf.enterprise_value !== 0
      ? dcf.pv_terminal_value / dcf.enterprise_value
      : null;
  const reverseStatus = reverseDcf?.solver_status ?? "pending";
  const waccStale = isWaccDataStale(valuationModel?.wacc_breakdown?.data_as_of);
  const availableModules = [
    true,
    Boolean(historical?.historical.length),
    Boolean(sensitivity),
    Boolean(reverseDcf),
  ].filter(Boolean).length;

  const primaryModel = data.primary_model ?? (data.dcf ? "dcf" : data.ddm ? "ddm" : "unknown");
  const wb = valuationModel?.wacc_breakdown;
  const waccAge = dataAgeDays(wb?.data_as_of);
  const waccFresh = waccAge == null ? true : waccAge < 180;
  const incomeDate = (data.dcf ?? data.ddm)?.assumptions_used as { income_date?: string } | null;
  const incomeAge = dataAgeDays(incomeDate?.income_date);
  const incomeStale = incomeAge == null ? false : incomeAge > 365;

  const items: DiagnosticItem[] = [
    {
      label: "Primary model",
      value: primaryModel.toUpperCase(),
      note:
        primaryModel === "ddm"
          ? "Financial institution / REIT — DDM selected over DCF."
          : "Standard DCF applied to this sector.",
      tone: "ok",
      icon: Database,
    },
    {
      label: "Data coverage",
      value: `${availableModules}/4 modules`,
      note:
        availableModules === 4
          ? "Core valuation, history, sensitivity, and reverse DCF loaded."
          : "Some secondary modules were skipped after best-effort fetches.",
      tone: availableModules >= 3 ? "ok" : "watch",
      icon: Database,
    },
    {
      label: "Model caveats",
      value: warningCount === 0 ? "Clear" : `${warningCount} flag${warningCount === 1 ? "" : "s"}`,
      note:
        warningCount === 0
          ? "No model warnings returned by the API."
          : "Review warnings before interpreting the valuation range.",
      tone: warningCount === 0 ? "ok" : warningCount <= 2 ? "watch" : "risk",
      icon: TriangleAlert,
    },
    {
      label: "Peer quality",
      value: `${validPeers} peer${validPeers === 1 ? "" : "s"}`,
      note:
        skippedPeers > 0
          ? `${skippedPeers} candidate${skippedPeers === 1 ? "" : "s"} skipped for incomplete data.`
          : `Source: ${multiples.peer_source ?? "provider/default"}.`,
      tone: validPeers >= 3 ? "ok" : validPeers > 0 ? "watch" : "risk",
      icon: Users,
    },
    {
      label: "WACC freshness",
      value: waccFresh ? "Current" : `Stale (${waccAge}d)`,
      note:
        waccFresh
          ? `Risk-free rate and ERP sourced ${wb?.data_as_of ?? "recently"}.`
          : "WACC inputs are older than 6 months — verify against current market data.",
      tone: waccFresh ? "ok" : "watch",
      icon: Gauge,
    },
    {
      label: "Financial data age",
      value: incomeStale ? `Stale (${incomeAge}d)` : "Recent",
      note:
        incomeStale
          ? "Latest income statement is over a year old — projections may not reflect current operations."
          : "Income statement data is reasonably recent.",
      tone: incomeStale ? "watch" : "ok",
      icon: Database,
    },
    {
      label: "DCF dependency",
      value: tvExposure == null ? "N/A" : pct(tvExposure),
      note:
        tvExposure == null
          ? dcf
            ? "Terminal value exposure unavailable."
            : "DCF terminal-value exposure does not apply to this model."
          : "Present value of terminal value as share of enterprise value.",
      tone: tvExposure == null ? "watch" : tvExposure > 0.85 ? "risk" : tvExposure > 0.7 ? "watch" : "ok",
      icon: Gauge,
    },
    {
      label: "Reverse DCF",
      value: reverseStatus.replace(/_/g, " "),
      note:
        reverseStatus === "solved"
          ? "Market-implied growth solved inside the default range."
          : "Solver status requires interpretation in the reverse DCF section.",
      tone: reverseStatus === "solved" ? "ok" : reverseStatus === "pending" ? "watch" : "risk",
      icon: Activity,
    },
  ];

  return (
    <section className="model-diagnostics" aria-labelledby="model-diagnostics-title">
      <div className="model-diagnostics-header">
        <div>
          <span className="section-kicker">MODEL CONTROL</span>
          <h2 id="model-diagnostics-title">Diagnostics</h2>
        </div>
        <div className="model-diagnostics-meta">
          <span>{methodCount} valuation method{methodCount === 1 ? "" : "s"}</span>
          <span>{waccStale ? "WACC inputs stale" : "WACC inputs current"}</span>
        </div>
      </div>

      <div className="model-diagnostics-grid">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={`model-diagnostic-card tone-${item.tone}`}>
              <div className="model-diagnostic-icon" aria-hidden="true">
                <Icon size={16} strokeWidth={1.8} />
              </div>
              <div>
                <span className="model-diagnostic-label">{item.label}</span>
                <strong className="model-diagnostic-value">{item.value}</strong>
                <span className="model-diagnostic-note">{item.note}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
