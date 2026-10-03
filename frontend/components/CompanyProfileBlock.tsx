"use client";

import { useState } from "react";
import type { CompanyProfile } from "@/types/valuation";
import { abbreviateNumber, formatMultiple } from "@/lib/format";

const CLAMP_AT = 520;

export function CompanyProfileBlock({ profile }: { profile: CompanyProfile }) {
  const [expanded, setExpanded] = useState(false);
  const description = profile.description ?? "";
  const long = description.length > CLAMP_AT;

  const facts: Array<[string, string]> = [
    ["Exchange", profile.exchange_full_name ?? profile.exchange ?? "—"],
    ["Sector", profile.sector ?? "—"],
    ["Industry", profile.industry ?? "—"],
    ["Country", profile.country ?? "—"],
    ["Market cap", abbreviateNumber(profile.market_cap, profile.currency)],
    ["Shares outstanding", profile.shares_outstanding ? `${(profile.shares_outstanding / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })}M` : "—"],
    ["Beta", profile.beta != null && Number.isFinite(profile.beta) ? profile.beta.toFixed(2) : "—"],
    ["P/E (TTM)", formatMultiple(profile.pe_ratio)],
  ];

  return (
    <div className="profile">
      <div className="profile-about">
        {description ? (
          <>
            <p className={`profile-description${long && !expanded ? " is-clamped" : ""}`}>{description}</p>
            {long ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                {expanded ? "Show less" : "Read full description"}
              </button>
            ) : null}
          </>
        ) : (
          <p className="tone-muted">No business description was provided.</p>
        )}
      </div>
      <dl className="profile-facts">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
