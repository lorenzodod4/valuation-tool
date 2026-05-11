"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CompanyProfile } from "@/types/valuation";
import { abbreviateNumber, formatCurrency } from "@/lib/format";

interface ValuationTickerHeaderProps {
  profile: CompanyProfile;
}

export function ValuationTickerHeader({ profile }: ValuationTickerHeaderProps) {
  const meta = [profile.sector, profile.industry, profile.country].filter(
    (item): item is string => Boolean(item),
  );

  // Compute the refresh timestamp on the client after mount so the rendered
  // string matches between SSR and hydration (Date.now() in render would
  // produce mismatched strings).
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  useEffect(() => {
    setRefreshedAt(
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }, [profile.symbol]);

  return (
    <>
      <Link href="/" className="back-link">
        ← Back to search
      </Link>

      <div className="ticker-header">
        <div className="ticker-header-left">
          <div className="ticker-id">
            <span className="ticker-symbol">{profile.symbol}</span>
            {profile.name ? (
              <span className="ticker-name">{profile.name}</span>
            ) : null}
          </div>
          {meta.length > 0 ? (
            <div className="ticker-meta">
              {meta.map((item, i) => (
                <span key={item}>
                  {i > 0 ? <span className="ticker-meta-sep">·</span> : null}
                  {i > 0 ? " " : ""}
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="ticker-header-right">
          <div>
            <div className="metric-label">CURRENT PRICE</div>
            <div>
              <span className="price-value">
                {profile.price != null ? formatCurrency(profile.price) : "—"}
              </span>
              {profile.currency ? (
                <span className="price-currency">{profile.currency}</span>
              ) : null}
            </div>
          </div>

          <div className="market-cap">
            <div className="metric-label">MARKET CAP</div>
            <div className="market-cap-value">
              {abbreviateNumber(profile.market_cap)}
            </div>
            {refreshedAt ? (
              <p className="data-refresh-note">
                Data refreshed {refreshedAt} · 15-min delay
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
