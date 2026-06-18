"""Pydantic response/request models for the valuation API."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


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
    ebit_margin: float | None = Field(default=None, ge=-0.50, le=0.70)
    tax_rate: float | None = Field(default=None, ge=0.0, le=0.40)
    da_pct_revenue: float | None = Field(default=None, ge=0.0, le=0.50)
    capex_pct_revenue: float | None = Field(default=None, ge=0.0, le=0.50)
    wc_change_pct_revenue: float | None = Field(default=None, ge=-0.30, le=0.30)
    wacc: float | None = Field(default=None, ge=0.03, le=0.25)
    terminal_growth_rate: float | None = Field(default=None, ge=-0.02, le=0.06)


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


class SectorWarning(BaseModel):
    """Non-fatal advisory attached to a DCF result for sectors where DCF
    is not the standard valuation methodology (banks, REITs)."""

    type: str
    message: str


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
    sector_warning: SectorWarning | None = None


class MultiplesResult(BaseModel):
    target_metrics: dict[str, Any]
    peer_statistics: dict[str, Any]
    implied_valuations: dict[str, Any]
    current_price: float | None = None
    peers_used: list[str]
    peer_source: str | None = None
    warnings: list[str] = []


class ReverseDCFResult(BaseModel):
    implied_growth_rate: float
    target_price: float
    base_assumptions_growth: float | None = None
    base_fair_value: float | None = None
    margin_of_safety: float | None = None
    interpretation: str
    wacc: float | None = None
    terminal_growth_rate: float | None = None
    solver_status: str = "solved"
    growth_floor: float = -0.10
    growth_ceiling: float = 0.50
    fair_value_at_growth_floor: float | None = None
    fair_value_at_growth_ceiling: float | None = None


class DDMResult(BaseModel):
    """Dividend Discount Model result for financial institutions."""

    model: str = "ddm"
    projections: list[dict[str, Any]]
    terminal_value_per_share: float | None = None
    pv_terminal_value: float | None = None
    per_share_value: float | None = None
    current_price: float | None = None
    upside_pct: float | None = None
    dividend_yield: float | None = None
    latest_dps: float | None = None
    assumptions_used: dict[str, Any]
    wacc_breakdown: WACCBreakdown | None = None
    warnings: list[str] = []


class FullValuation(BaseModel):
    profile: CompanyProfile
    dcf: DCFResult | None = None
    ddm: DDMResult | None = None
    multiples: MultiplesResult
