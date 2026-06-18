"use client";

import Link from "next/link";
import type { CompanyProfile } from "@/types/valuation";
import { abbreviateNumber, formatCurrency } from "@/lib/format";

interface ValuationTickerHeaderProps {
  profile: CompanyProfile;
}

export function ValuationTickerHeader({ profile }: ValuationTickerHeaderProps) {
  const meta = [profile.sector, profile.industry, profile.country].filter(
    (item): item is string => Boolean(item),
  );

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
            <p className="data-refresh-note">
              Provider data may be delayed
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
