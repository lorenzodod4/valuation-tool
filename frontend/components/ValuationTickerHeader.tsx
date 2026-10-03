"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import type { CompanyProfile } from "@/types/valuation";
import { abbreviateNumber } from "@/lib/format";

interface ValuationTickerHeaderProps {
  profile: CompanyProfile;
  actions?: ReactNode;
}

function asOfLabel(epochSeconds: number | null | undefined): string | null {
  if (!epochSeconds) return null;
  const d = new Date(epochSeconds * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ValuationTickerHeader({ profile, actions }: ValuationTickerHeaderProps) {
  const meta = [profile.sector, profile.industry, profile.country].filter(
    (item): item is string => Boolean(item),
  );
  const asOf = asOfLabel(profile.data_as_of);

  return (
    <header className="report-header">
      <Link href="/" className="back-link">
        <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
        New analysis
      </Link>
      <div className="report-header-main">
        <div className="report-identity">
          <div className="report-symbol-row">
            <span className="report-symbol mono">{profile.symbol}</span>
            {profile.exchange ? <span className="badge">{profile.exchange}</span> : null}
            {profile.currency ? <span className="badge">{profile.currency}</span> : null}
            {profile.served_stale ? <span className="badge badge-warn">Cached copy</span> : null}
          </div>
          <h1 className="report-name">{profile.name ?? profile.symbol}</h1>
          {meta.length > 0 ? <p className="report-meta">{meta.join(" · ")}</p> : null}
        </div>
        <div className="report-header-side">
          <dl className="report-header-facts">
            <div>
              <dt>Market cap</dt>
              <dd className="num">{abbreviateNumber(profile.market_cap, profile.currency)}</dd>
            </div>
            <div>
              <dt>Data as of</dt>
              <dd className="num">{asOf ?? "—"}</dd>
            </div>
          </dl>
          {actions}
        </div>
      </div>
    </header>
  );
}
