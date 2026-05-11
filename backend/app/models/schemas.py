"""Pydantic response/request models for the valuation API."""

from typing import Any

from pydantic import BaseModel, ConfigDict


class CompanyProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")

    symbol: str
    name: str | None = None
    sector: str | None = None
    industry: str | None = None
    country: str | None = None
    market_cap: float | None = None
    price: float | None = None
    currency: str | None = None
    pe_ratio: float | None = None
    forward_pe: float | None = None
    shares_outstanding: float | None = None
    beta: float | None = None
    description: str | None = None


class FinancialStatement(BaseModel):
    profile: CompanyProfile
    income_statement: list[dict[str, Any]]
    balance_sheet: list[dict[str, Any]]
    cash_flow: list[dict[str, Any]]


class DCFAssumptions(BaseModel):
    """Optional overrides for DCF assumptions; missing fields fall back to auto-derived defaults."""

    revenue_growth_rates: list[float] | None = None
    ebit_margin: float | None = None
    tax_rate: float | None = None
    da_pct_revenue: float | None = None
    capex_pct_revenue: float | None = None
    wc_change_pct_revenue: float | None = None
    wacc: float | None = None
    terminal_growth_rate: float | None = None


class WACCBreakdown(BaseModel):
    """Per-ticker WACC decomposition with sources cited."""

    model_config = ConfigDict(extra="ignore")

    risk_free_rate: float | None = None
    equity_risk_premium: float | None = None
    beta: float | None = None
    beta_source: str | None = None
    cost_of_equity: float | None = None
    cost_of_debt_pretax: float | None = None
    tax_rate: float | None = None
    cost_of_debt_aftertax: float | None = None
    market_cap: float | None = None
    total_debt: float | None = None
    weight_equity: float | None = None
    weight_debt: float | None = None
    wacc: float | None = None
    data_as_of: str | None = None
    rf_source: str | None = None
    erp_source: str | None = None


class DCFResult(BaseModel):
    projections: list[dict[str, Any]]
    terminal_value: float
    pv_terminal_value: float
    enterprise_value: float
    net_debt: float
    equity_value: float
    shares_outstanding: float | None = None
    per_share_value: float | None = None
    current_price: float | None = None
    upside_pct: float | None = None
    assumptions_used: dict[str, Any]
    wacc_breakdown: WACCBreakdown | None = None
    warnings: list[str] = []


class MultiplesResult(BaseModel):
    target_metrics: dict[str, Any]
    peer_statistics: dict[str, Any]
    implied_valuations: dict[str, Any]
    current_price: float | None = None
    peers_used: list[str]


class FullValuation(BaseModel):
    profile: CompanyProfile
    dcf: DCFResult
    multiples: MultiplesResult
