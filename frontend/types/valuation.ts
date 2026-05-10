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
}

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
  };
  implied_valuations: ImpliedValuations;
  current_price: number | null;
  peers_used: string[];
}

export interface FullValuation {
  profile: CompanyProfile;
  dcf: DCFResult;
  multiples: MultiplesResult;
}
