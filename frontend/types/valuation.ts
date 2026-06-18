export interface CompanyProfile {
  symbol: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  market_cap: number | null;
  price: number | null;
  currency: string | null;
  pe_ratio: number | null;
  forward_pe: number | null;
  shares_outstanding: number | null;
  beta: number | null;
  description: string | null;
  exchange?: string | null;
  exchange_full_name?: string | null;
}

export type WACCBreakdown = {
  risk_free_rate: number;
  equity_risk_premium: number;
  beta: number;
  beta_source: string;
  cost_of_equity: number;
  cost_of_debt_pretax: number;
  tax_rate: number;
  cost_of_debt_aftertax: number;
  market_cap: number;
  total_debt: number;
  weight_equity: number;
  weight_debt: number;
  wacc: number;
  data_as_of: string;
  rf_source: string;
  erp_source: string;
};

export interface DCFAssumptions {
  revenue_growth_rates?: number[];
  ebit_margin?: number;
  tax_rate?: number;
  da_pct_revenue?: number;
  capex_pct_revenue?: number;
  wc_change_pct_revenue?: number;
  wacc?: number;
  terminal_growth_rate?: number;
}

export interface DCFProjection {
  year: number;
  revenue: number;
  ebit: number;
  nopat: number;
  fcff: number;
  pv_fcff: number;
}

export interface SectorWarning {
  type: "dcf_unsuitable" | string;
  message: string;
}

export interface DCFResult {
  projections: DCFProjection[];
  terminal_value: number;
  pv_terminal_value: number;
  enterprise_value: number;
  net_debt: number;
  equity_value: number;
  shares_outstanding: number | null;
  per_share_value: number | null;
  current_price: number | null;
  upside_pct: number | null;
  assumptions_used: Record<string, unknown>;
  wacc_breakdown?: WACCBreakdown | null;
  warnings: string[];
  sector_warning?: SectorWarning | null;
}

export interface DDMProjection {
  year: number;
  dps: number;
  pv_dps: number;
}

export interface DDMResult {
  model: "ddm";
  projections: DDMProjection[];
  terminal_value_per_share: number | null;
  pv_terminal_value: number | null;
  per_share_value: number | null;
  current_price: number | null;
  upside_pct: number | null;
  dividend_yield: number | null;
  latest_dps: number | null;
  assumptions_used: Record<string, unknown>;
  wacc_breakdown?: WACCBreakdown | null;
  warnings: string[];
}

export interface PeerMultiples {
  ticker: string;
  symbol?: string;
  name?: string | null;
  pe_ratio: number | null;
  ev_ebitda: number | null;
  ev_sales: number | null;
  p_book: number | null;
  market_cap: number | null;
  enterprise_value: number | null;
  revenue: number | null;
  ebitda: number | null;
  net_income: number | null;
}

export interface PeerStatistic {
  median: number | null;
  mean: number | null;
  min: number | null;
  max: number | null;
  p25?: number | null;
  p75?: number | null;
  count: number;
}

export interface PeerStatistics {
  pe_ratio: PeerStatistic;
  ev_ebitda: PeerStatistic;
  ev_sales: PeerStatistic;
  p_book: PeerStatistic;
}

export interface ImpliedValuation {
  implied_market_cap: number | null;
  implied_per_share: number | null;
  implied_per_share_low?: number | null;
  implied_per_share_high?: number | null;
  multiple_used: number | null;
  implied_enterprise_value?: number | null;
}

export interface ImpliedValuations {
  pe_based: ImpliedValuation | null;
  ev_ebitda_based: ImpliedValuation | null;
  ev_sales_based: ImpliedValuation | null;
}

export interface MultiplesResult {
  target_metrics: PeerMultiples & Record<string, unknown>;
  peer_statistics: {
    peers: PeerMultiples[];
    statistics: PeerStatistics;
    skipped_peers?: Array<{ symbol: string; reason: string }>;
  };
  implied_valuations: ImpliedValuations;
  current_price: number | null;
  peers_used: string[];
  peer_source?: "custom" | "fmp_stock_peers" | "static_fallback" | string | null;
  warnings?: string[];
}

export interface FullValuation {
  profile: CompanyProfile;
  dcf: DCFResult | null;
  ddm: DDMResult | null;
  multiples: MultiplesResult;
  primary_model: "dcf" | "ddm";
}

export type HistoricalFinancials = {
  symbol: string;
  historical: Array<{
    year: number;
    revenue: number;
    ebitda: number;
    net_income: number;
    operating_income: number;
  }>;
};

export type SensitivityTable = {
  symbol: string;
  wacc_values: number[];
  terminal_growth_values: number[];
  grid: (number | null)[][];
  current_price: number | null;
};

export interface ReverseDCFResult {
  implied_growth_rate: number;
  target_price: number;
  base_assumptions_growth: number | null;
  base_fair_value: number | null;
  margin_of_safety: number | null;
  interpretation: string;
  wacc: number | null;
  terminal_growth_rate: number | null;
  solver_status: "solved" | "below_range" | "above_range" | "unstable" | string;
  growth_floor: number;
  growth_ceiling: number;
  fair_value_at_growth_floor: number | null;
  fair_value_at_growth_ceiling: number | null;
}
