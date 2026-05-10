import type { ReactNode } from "react";

interface Feature {
  num: string;
  iconClass: string;
  icon: ReactNode;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    num: "01",
    iconClass: "icon-green",
    icon: (
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
        <path
          d="M2 13L5.5 9.5L8.5 11.5L14 4"
          stroke="currentColor"
          strokeWidth={1.3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx={14} cy={4} r={1.5} fill="currentColor" />
      </svg>
    ),
    title: "Discounted cash flow",
    description:
      "5-year forecast with terminal value, WACC sensitivity, and growth scenarios.",
  },
  {
    num: "02",
    iconClass: "icon-indigo",
    icon: (
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
        <rect x={2} y={9} width={2.5} height={5} fill="currentColor" />
        <rect x={6.75} y={5} width={2.5} height={9} fill="currentColor" />
        <rect x={11.5} y={2} width={2.5} height={12} fill="currentColor" />
      </svg>
    ),
    title: "Trading comparables",
    description:
      "P/E, EV/EBITDA, EV/Sales benchmarked against custom peer groups.",
  },
  {
    num: "03",
    iconClass: "icon-coral",
    icon: (
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
        <line
          x1={3}
          y1={3.5}
          x2={11}
          y2={3.5}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <line
          x1={2}
          y1={8}
          x2={13}
          y2={8}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <line
          x1={4}
          y1={12.5}
          x2={9}
          y2={12.5}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
    ),
    title: "Football field",
    description:
      "All methods unified into one valuation range, ready for the deck.",
  },
];

export function FeatureCards() {
  return (
    <div className="feature-cards-grid">
      {FEATURES.map((feature) => (
        <div key={feature.num} className="feature-card">
          <div className="feature-card-top">
            <span
              className={`icon-box ${feature.iconClass}`}
              aria-hidden="true"
            >
              {feature.icon}
            </span>
            <span className="card-num">{feature.num}</span>
          </div>
          <h3 className="card-title">{feature.title}</h3>
          <p className="card-desc">{feature.description}</p>
        </div>
      ))}
    </div>
  );
}
