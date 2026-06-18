"""Dividend Discount Model (DDM) valuation for financial institutions.

DDM is the standard methodology for banks, REITs, insurance companies, and
asset managers where traditional DCF (free cash flow) is not well-suited.
"""

import logging
import math
from typing import Any

from app.services.wacc import compute_wacc

logger = logging.getLogger(__name__)

DEFAULT_DIVIDEND_GROWTH = 0.025
DEFAULT_TERMINAL_GROWTH = 0.02
DEFAULT_COST_OF_EQUITY = 0.10
GROWTH_CAP = 0.10

# Sectors where DDM is the preferred methodology
DDM_SECTORS = {
    "Financial Services",
    "Real Estate",
}


class DDMValuator:
    """Compute DDM valuation using dividend history and cost of equity."""

    def compute_assumptions_from_history(
        self, financials: dict[str, Any]
    ) -> dict[str, Any]:
        """Derive DDM assumptions from historical dividend data and profile."""
        warnings: list[str] = []
        income: list[dict[str, Any]] = financials.get("income_statement") or []
        cashflow: list[dict[str, Any]] = financials.get("cash_flow") or []
        balance: list[dict[str, Any]] = financials.get("balance_sheet") or []
        profile: dict[str, Any] = financials.get("profile") or {}

        # Compute dividend growth from historical dividends per share
        dividend_growth = self._compute_dividend_growth(
            cashflow, warnings
        )

        # Terminal growth is typically lower than near-term for mature dividend payers
        terminal_growth = min(DEFAULT_TERMINAL_GROWTH, dividend_growth * 0.8)

        # Cost of equity via CAPM (same as DCF Re component)
        latest_balance = balance[0] if balance else {}
        latest_income = income[0] if income else {}
        
        # For DDM, we only need cost of equity (no debt component)
        # Use effective tax rate for reference
        tax_rate = 0.21
        if income:
            pretax = income[0].get("pretax_income")
            tax = income[0].get("income_tax")
            if pretax and pretax > 0 and tax is not None:
                tax_rate = max(0.0, min(0.35, tax / pretax))

        wacc_result = compute_wacc(
            market_cap=profile.get("market_cap"),
            total_debt=latest_balance.get("total_debt"),
            beta=profile.get("beta"),
            interest_expense=latest_income.get("interest_expense"),
            tax_rate=tax_rate,
        )

        # Extract cost of equity from WACC breakdown
        cost_of_equity = DEFAULT_COST_OF_EQUITY
        if wacc_result.get("breakdown"):
            breakdown = wacc_result["breakdown"]
            cost_of_equity = breakdown.get("cost_of_equity", DEFAULT_COST_OF_EQUITY)
        elif wacc_result.get("warning"):
            warnings.append(
                f"Cost of equity fell back to default {DEFAULT_COST_OF_EQUITY:.2%}: "
                f"{wacc_result['warning']}"
            )

        # Get latest dividend per share
        latest_dps = self._get_latest_dps(cashflow, profile, warnings)

        # Payout ratio for context
        payout_ratio = self._compute_payout_ratio(income, cashflow, warnings)

        return {
            "dividend_growth_rate": dividend_growth,
            "terminal_growth_rate": terminal_growth,
            "cost_of_equity": cost_of_equity,
            "latest_dps": latest_dps,
            "payout_ratio": payout_ratio,
            "wacc_breakdown": wacc_result.get("breakdown"),
            "warnings": warnings,
        }

    def run_ddm(
        self, financials: dict[str, Any], assumptions: dict[str, Any]
    ) -> dict[str, Any]:
        """Execute DDM: project dividends and discount to present value."""
        assumptions_used = dict(assumptions)
        cost_of_equity: float = assumptions_used["cost_of_equity"]
        dividend_growth: float = assumptions_used["dividend_growth_rate"]
        terminal_growth: float = assumptions_used["terminal_growth_rate"]
        latest_dps: float | None = assumptions_used.get("latest_dps")

        warnings: list[str] = list(assumptions_used.get("warnings", []))
        profile: dict[str, Any] = financials.get("profile") or {}

        # Validation
        if cost_of_equity <= terminal_growth:
            raise ValueError(
                f"Cost of equity ({cost_of_equity:.2%}) must exceed terminal "
                f"growth ({terminal_growth:.2%})"
            )
        if not math.isfinite(cost_of_equity) or not math.isfinite(terminal_growth):
            raise ValueError("Cost of equity and terminal growth must be finite")

        if latest_dps is None or latest_dps <= 0:
            warnings.append(
                "No positive dividend history found. DDM requires dividend-paying stocks."
            )
            # Return placeholder result
            return self._placeholder_result(financials, assumptions_used, warnings)

        # Project 5 years of dividends
        projections: list[dict[str, Any]] = []
        dps = float(latest_dps)
        pv_sum = 0.0

        for year in range(1, 6):
            dps = dps * (1 + dividend_growth)
            pv_dps = dps / (1 + cost_of_equity) ** year
            pv_sum += pv_dps
            projections.append({
                "year": year,
                "dps": dps,
                "pv_dps": pv_dps,
            })

        # Terminal value via Gordon Growth Model
        dps_year5 = projections[-1]["dps"]
        terminal_dps = dps_year5 * (1 + terminal_growth)
        terminal_value_per_share = terminal_dps / (cost_of_equity - terminal_growth)
        pv_terminal_value = terminal_value_per_share / (1 + cost_of_equity) ** 5

        # Intrinsic value per share
        per_share_value = pv_sum + pv_terminal_value

        # Compare to current price
        current_price = profile.get("price")
        if per_share_value is not None and current_price:
            upside_pct: float | None = (per_share_value - current_price) / current_price
        else:
            upside_pct = None

        # Sanity check
        if upside_pct is not None:
            if upside_pct < -0.70:
                warnings.append(
                    "DDM intrinsic value is more than 70% below market price. "
                    "The model may be underestimating dividend growth or the "
                    "company may trade on asset value rather than dividend yield."
                )
            elif upside_pct > 1.00:
                warnings.append(
                    "DDM intrinsic value is more than 100% above market price. "
                    "Verify dividend sustainability and growth assumptions."
                )

        # Compute dividend yield (latest annual dividend / current price)
        shares_outstanding = profile.get("shares_outstanding")
        dividend_yield: float | None = None
        if current_price and current_price > 0 and latest_dps:
            dividend_yield = latest_dps / current_price

        return {
            "model": "ddm",
            "projections": projections,
            "terminal_value_per_share": terminal_value_per_share,
            "pv_terminal_value": pv_terminal_value,
            "per_share_value": per_share_value,
            "current_price": current_price,
            "upside_pct": upside_pct,
            "dividend_yield": dividend_yield,
            "latest_dps": latest_dps,
            "assumptions_used": assumptions_used,
            "wacc_breakdown": assumptions_used.get("wacc_breakdown"),
            "warnings": warnings,
        }

    def _placeholder_result(
        self,
        financials: dict[str, Any],
        assumptions: dict[str, Any],
        warnings: list[str],
    ) -> dict[str, Any]:
        """Return a valid but empty DDM result when no dividend data exists."""
        profile: dict[str, Any] = financials.get("profile") or {}
        return {
            "model": "ddm",
            "projections": [],
            "terminal_value_per_share": None,
            "pv_terminal_value": None,
            "per_share_value": None,
            "current_price": profile.get("price"),
            "upside_pct": None,
            "dividend_yield": None,
            "latest_dps": None,
            "assumptions_used": assumptions,
            "wacc_breakdown": assumptions.get("wacc_breakdown"),
            "warnings": warnings,
        }

    @staticmethod
    def _compute_dividend_growth(
        cashflow: list[dict[str, Any]], warnings: list[str]
    ) -> float:
        """Compute historical dividend growth rate (CAGR)."""
        try:
            # Extract dividends paid (negative outflows from cash flow statement)
            dividends = []
            for row in cashflow[:5]:  # Up to 5 years
                div = row.get("dividendsPaid") or row.get("dividends_paid")
                if div is not None:
                    # FMP reports as negative, convert to positive
                    dividends.append(abs(float(div)))

            if len(dividends) < 2:
                warnings.append(
                    "Insufficient dividend history; using default growth "
                    f"{DEFAULT_DIVIDEND_GROWTH:.2%}"
                )
                return DEFAULT_DIVIDEND_GROWTH

            # CAGR from oldest to most recent
            start = dividends[-1]
            end = dividends[0]
            periods = len(dividends) - 1

            if start <= 0 or end <= 0:
                warnings.append(
                    "Non-positive dividend in history; using default growth"
                )
                return DEFAULT_DIVIDEND_GROWTH

            cagr = (end / start) ** (1 / periods) - 1
            # Cap growth at reasonable level for mature dividend payers
            capped = max(min(cagr, GROWTH_CAP), 0.0)
            
            if capped != cagr:
                warnings.append(
                    f"Historical dividend CAGR ({cagr:.2%}) capped at {GROWTH_CAP:.2%}"
                )

            return capped

        except (TypeError, ValueError, ZeroDivisionError):
            warnings.append("Failed to compute dividend growth; using default")
            return DEFAULT_DIVIDEND_GROWTH

    @staticmethod
    def _get_latest_dps(
        cashflow: list[dict[str, Any]],
        profile: dict[str, Any],
        warnings: list[str],
    ) -> float | None:
        """Extract latest dividend per share."""
        if not cashflow:
            return None

        latest = cashflow[0]
        div_paid = latest.get("dividendsPaid") or latest.get("dividends_paid")
        if div_paid is None:
            return None

        # Convert to positive (FMP reports as negative)
        total_div = abs(float(div_paid))
        shares = profile.get("shares_outstanding")

        if not shares or shares <= 0:
            warnings.append("Shares outstanding missing; cannot compute DPS")
            return None

        return total_div / shares

    @staticmethod
    def _compute_payout_ratio(
        income: list[dict[str, Any]],
        cashflow: list[dict[str, Any]],
        warnings: list[str],
    ) -> float | None:
        """Compute dividend payout ratio (dividends / net income)."""
        if not income or not cashflow:
            return None

        try:
            net_income = income[0].get("net_income")
            div_paid = cashflow[0].get("dividendsPaid") or cashflow[0].get("dividends_paid")

            if net_income is None or div_paid is None:
                return None

            net_income = float(net_income)
            div_paid = abs(float(div_paid))

            if net_income <= 0:
                warnings.append("Net income is non-positive; payout ratio unavailable")
                return None

            return div_paid / net_income

        except (TypeError, ValueError, ZeroDivisionError):
            return None

    @staticmethod
    def should_use_ddm(sector: str | None) -> bool:
        """Determine if DDM should be used instead of DCF for this sector."""
        if not sector:
            return False
        return sector.strip() in DDM_SECTORS


if __name__ == "__main__":
    from app.services.data_fetcher import FinancialDataFetcher

    fetcher = FinancialDataFetcher()
    valuator = DDMValuator()

    # Test with JPM (bank)
    print("Fetching JPM financials...")
    financials = fetcher.get_all_for_ticker("JPM")
    if financials is None:
        raise SystemExit("Ticker JPM not found on FMP")

    assumptions = valuator.compute_assumptions_from_history(financials)
    result = valuator.run_ddm(financials, assumptions)

    print("\n=== DDM Result (JPM) ===")
    print(f"Current Price:       {result['current_price']}")
    psv = result['per_share_value']
    print(f"Per-Share Value:     {psv:,.2f}" if psv is not None else "Per-Share Value:     n/a")
    upside = result['upside_pct']
    print(f"Upside:              {upside:.1%}" if upside is not None else "Upside:              n/a")
    print(f"Dividend Yield:      {result['dividend_yield']:.2%}" if result['dividend_yield'] else "Dividend Yield:      n/a")
    print(f"Latest DPS:          ${result['latest_dps']:.2f}" if result['latest_dps'] else "Latest DPS:          n/a")

    print("\n=== Key Assumptions ===")
    print(f"Dividend Growth:     {assumptions['dividend_growth_rate']:.2%}")
    print(f"Terminal Growth:     {assumptions['terminal_growth_rate']:.2%}")
    print(f"Cost of Equity:      {assumptions['cost_of_equity']:.2%}")
    print(f"Payout Ratio:        {assumptions['payout_ratio']:.1%}" if assumptions.get('payout_ratio') else "Payout Ratio:        n/a")

    if result["warnings"]:
        print("\n=== Warnings ===")
        for w in result["warnings"]:
            print(f"- {w}")
