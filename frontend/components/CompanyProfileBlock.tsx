"use client";

import { useState } from "react";
import type { CompanyProfile } from "@/types/valuation";
import { abbreviateNumber } from "@/lib/format";

interface CompanyProfileBlockProps {
  profile: CompanyProfile;
}

const SHOW_MORE_THRESHOLD = 600;

export function CompanyProfileBlock({ profile }: CompanyProfileBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const description = profile.description ?? "";
  const hasDescription = description.length > 0;
  const needsExpansion = description.length > SHOW_MORE_THRESHOLD;

  const subtitle =
    profile.industry ?? profile.sector ?? "Company overview";

  const facts: Array<{ label: string; value: string }> = [
    { label: "Exchange", value: profile.exchange ?? "—" },
    {
      label: "Beta (5y monthly)",
      value:
        profile.beta != null && Number.isFinite(profile.beta)
          ? profile.beta.toFixed(3)
          : "—",
    },
    { label: "Currency", value: profile.currency ?? "—" },
    { label: "Country", value: profile.country ?? "—" },
    { label: "Market Cap", value: abbreviateNumber(profile.market_cap) },
  ];

  return (
    <section className="valuation-section">
      <header className="section-header">
        <div className="section-title-group">
          <span className="section-num">00</span>
          <span className="section-title">Company Profile</span>
        </div>
        <span className="section-subtitle">{subtitle}</span>
      </header>

      <div className="profile-block-grid">
        <div className="profile-block-about">
          <div className="profile-block-section-label">About</div>
          {hasDescription ? (
            <>
              <div
                className={
                  expanded
                    ? "profile-description expanded"
                    : "profile-description"
                }
              >
                {description}
                {!expanded && needsExpansion ? (
                  <div
                    className="profile-fade-overlay"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              {needsExpansion ? (
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="profile-show-more"
                >
                  {expanded ? "Show less" : "Show more"}
                </button>
              ) : null}
            </>
          ) : (
            <div className="profile-no-desc">No description available.</div>
          )}
        </div>

        <div className="profile-block-facts">
          <div className="profile-block-section-label">Key Facts</div>
          <div className="profile-pills">
            {facts.map((fact) => (
              <div key={fact.label} className="profile-pill">
                <span className="profile-pill-label">{fact.label}</span>
                <span className="profile-pill-value">{fact.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
