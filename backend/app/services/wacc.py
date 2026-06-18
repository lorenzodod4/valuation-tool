"""WACC computation: CAPM cost of equity + weighted average."""

from datetime import date, datetime
from typing import Any

from app.config import WACC_INPUTS


def compute_cost_of_equity(beta: float | None) -> float:
    """CAPM: Re = Rf + β × ERP. Falls back to market beta (1.0) when missing."""
    rf = float(WACC_INPUTS["risk_free_rate"])
    erp = float(WACC_INPUTS["equity_risk_premium"])
    if beta is None or beta <= 0:
        beta = 1.0
    return rf + beta * erp


def compute_cost_of_debt_pretax(
    interest_expense: float | None,
    total_debt: float | None,
) -> float:
    """Pre-tax Rd = |Interest Expense| / Total Debt, clamped to a sane range.
    
    Uses absolute value so negative interest expense (cash/interest income)
    is treated as a positive cost magnitude rather than falling back to default.
    """
    default = float(WACC_INPUTS["default_cost_of_debt_pretax"])
    if not total_debt or total_debt <= 0:
        return default
    if interest_expense is None:
        return default
    rd = abs(interest_expense) / total_debt
    # Clamp to a realistic corporate range (1%–15%) — protects against bad data.
    return max(0.01, min(0.15, rd))


def compute_wacc(
    market_cap: float | None,
    total_debt: float | None,
    beta: float | None,
    interest_expense: float | None,
    tax_rate: float = 0.21,
) -> dict[str, Any]:
    """Full WACC computation with full breakdown for transparency."""
    cost_of_equity = compute_cost_of_equity(beta)
    cost_of_debt_pretax = compute_cost_of_debt_pretax(interest_expense, total_debt)
    cost_of_debt_aftertax = cost_of_debt_pretax * (1 - tax_rate)

    if not market_cap or market_cap <= 0:
        return {
            "wacc": None,
            "breakdown": None,
            "warning": "market_cap_missing",
        }

    debt = total_debt or 0.0
    total_capital = market_cap + debt
    weight_equity = market_cap / total_capital if total_capital > 0 else 1.0
    weight_debt = debt / total_capital if total_capital > 0 else 0.0

    wacc = weight_equity * cost_of_equity + weight_debt * cost_of_debt_aftertax

    effective_beta = beta if beta and beta > 0 else 1.0
    beta_source = "FMP profile" if beta and beta > 0 else "market default (1.0)"

    return {
        "wacc": wacc,
        "breakdown": {
            "risk_free_rate": float(WACC_INPUTS["risk_free_rate"]),
            "equity_risk_premium": float(WACC_INPUTS["equity_risk_premium"]),
            "beta": effective_beta,
            "beta_source": beta_source,
            "cost_of_equity": cost_of_equity,
            "cost_of_debt_pretax": cost_of_debt_pretax,
            "tax_rate": tax_rate,
            "cost_of_debt_aftertax": cost_of_debt_aftertax,
            "market_cap": market_cap,
            "total_debt": debt,
            "weight_equity": weight_equity,
            "weight_debt": weight_debt,
            "wacc": wacc,
            "data_as_of": str(WACC_INPUTS["data_as_of"]),
            "rf_source": str(WACC_INPUTS["rf_source"]),
            "erp_source": str(WACC_INPUTS["erp_source"]),
        },
        "warning": None,
    }


def is_data_stale() -> bool:
    """True if WACC inputs are older than 6 months."""
    as_of = datetime.strptime(str(WACC_INPUTS["data_as_of"]), "%Y-%m-%d").date()
    age_days = (date.today() - as_of).days
    return age_days > 180
