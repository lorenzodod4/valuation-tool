import { CircleAlert, CircleCheck, CircleDashed, OctagonAlert, type LucideIcon } from "lucide-react";
import type { Async } from "@/lib/async";
import type {
  FullValuation,
  HistoricalFinancials,
  MultiplesResult,
  ReverseDCFResult,
  SensitivityTable,
} from "@/types/valuation";
import { formatDate, formatRate } from "@/lib/format";

interface ModelDiagnosticsProps {
  data: FullValuation;
  multiples: MultiplesResult | null;
  historical: Async<HistoricalFinancials>;
  sensitivity: Async<SensitivityTable>;
  reverseDcf: Async<ReverseDCFResult>;
  methodCount: number;
}

type Tone = "ok" | "watch" | "risk" | "info";

const TONE: Record<Tone, { icon: LucideIcon; label: string }> = {
  ok: { icon: CircleCheck, label: "OK" },
  watch: { icon: CircleAlert, label: "Check" },
  risk: { icon: OctagonAlert, label: "Caution" },
  info: { icon: CircleDashed, label: "Info" },
};

function ageDays(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86_400_000) : null;
}

export function ModelDiagnostics({ data, multiples, historical, sensitivity, reverseDcf, methodCount }: ModelDiagnosticsProps) {
  const isDDM = data.primary_model === "ddm";
  const model = isDDM ? data.ddm : data.dcf;
  const a = (model?.assumptions_used ?? {}) as { income_date?: string | null };
  const statementAge = ageDays(a.income_date);
  const waccAsOf = model?.wacc_breakdown?.data_as_of ?? null;
  const waccAge = ageDays(waccAsOf);
  const flags = (model?.warnings.length ?? 0) + (data.dcf?.sector_warning ? 1 : 0) + (multiples?.warnings?.length ?? 0);
  const peers = multiples?.peers_used.length ?? 0;
  const tv = data.dcf && data.dcf.enterprise_value > 0 ? data.dcf.pv_terminal_value / data.dcf.enterprise_value : null;
  const modules = [historical, sensitivity, reverseDcf];
  const loaded = modules.filter((m) => m.status === "ok").length;
  const applicable = modules.filter((m) => m.status !== "na").length;
  const pending = modules.some((m) => m.status === "loading");
  const rev = reverseDcf.status === "ok" ? reverseDcf.data.solver_status : null;

  const items: Array<{ label: string; value: string; note: string; tone: Tone }> = [
    {
      label: "Primary model",
      value: isDDM ? "DDM" : "DCF",
      note: model
        ? isDDM
          ? "Financial sector: dividends discounted at the cost of equity."
          : "Operating company: free cash flow to the firm discounted at WACC."
        : "The primary model could not run — see notices.",
      tone: model ? "info" : "risk",
    },
    {
      label: "Latest statement",
      value: a.income_date ? formatDate(a.income_date) : "Unknown",
      note:
        statementAge == null
          ? "Statement date not reported by the provider."
          : statementAge > 450
            ? `${statementAge} days old — projections may not reflect current operations.`
            : `${statementAge} days old.`,
      tone: statementAge == null ? "watch" : statementAge > 450 ? "risk" : "ok",
    },
    {
      label: "Quote",
      value: data.profile.served_stale ? "Cached copy" : "Fresh",
      note: data.profile.served_stale
        ? "Provider unavailable; the last cached quote was used."
        : "Fetched from the provider within the cache window (≤ 1 hour).",
      tone: data.profile.served_stale ? "risk" : "ok",
    },
    {
      label: "Market inputs",
      value: waccAsOf ?? "—",
      note:
        waccAge == null
          ? "Risk-free rate and ERP date unavailable."
          : waccAge > 180
            ? "Older than six months — verify the risk-free rate and ERP."
            : "Damodaran risk-free rate and equity risk premium.",
      tone: waccAge == null ? "watch" : waccAge > 180 ? "watch" : "ok",
    },
    {
      label: "Model flags",
      value: flags === 0 ? "None" : String(flags),
      note: flags === 0 ? "No sanity checks were triggered." : "Read the flags under each model before relying on it.",
      tone: flags === 0 ? "ok" : flags <= 2 ? "watch" : "risk",
    },
    {
      label: "Peer set",
      value: `${peers} peer${peers === 1 ? "" : "s"}`,
      note: peers >= 3 ? "Enough peers for a stable median." : "Fewer than three peers — medians are noisy.",
      tone: peers >= 3 ? "ok" : peers > 0 ? "watch" : "risk",
    },
  ];

  if (!isDDM) {
    items.push(
      {
        label: "Terminal dependence",
        value: tv == null ? "—" : formatRate(tv, 0),
        note: tv == null ? "Unavailable." : tv > 0.85 ? "Most of the value sits beyond year 5." : "Share of enterprise value from the terminal year.",
        tone: tv == null ? "watch" : tv > 0.85 ? "risk" : tv > 0.7 ? "watch" : "ok",
      },
      {
        label: "Reverse DCF",
        value: rev ? rev.replace(/_/g, " ") : reverseDcf.status === "loading" ? "Loading" : "Unavailable",
        note: rev === "solved" ? "Market-implied growth found within range." : "Interpret the reverse DCF with care.",
        tone: rev === "solved" ? "ok" : reverseDcf.status === "loading" ? "info" : "watch",
      },
    );
  }

  return (
    <div className="diagnostics">
      <p className="diagnostics-meta">
        {methodCount} valuation method{methodCount === 1 ? "" : "s"} · {pending ? "loading secondary modules" : `${loaded}/${applicable} secondary modules loaded`}
      </p>
      <ul className="diagnostics-grid">
        {items.map((item) => {
          const { icon: Icon, label } = TONE[item.tone];
          return (
            <li key={item.label} className={`diagnostic tone-${item.tone}`}>
              <div className="diagnostic-head">
                <span className="diagnostic-label">{item.label}</span>
                <span className="diagnostic-status">
                  <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
                  {label}
                </span>
              </div>
              <strong className="diagnostic-value">{item.value}</strong>
              <p>{item.note}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
