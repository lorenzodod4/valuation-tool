"""Simplified 5-year DCF valuation built on FMP-normalized financials."""

import logging
import math
from typing import Any

from app.services.wacc import compute_wacc

logger = logging.getLogger(__name__)


REVENUE_KEY = "revenue"

EBIT_KEYS = ("ebit", "operating_income")
DA_KEYS = ("da",)
CAPEX_KEYS = ("capex",)
WC_CHANGE_KEYS = ("wc_change",)

TOTAL_DEBT_KEYS = ("total_debt",)
CASH_KEYS = ("cash",)

DEFAULT_EBIT_MARGIN = 0.15
DEFAULT_DA_PCT = 0.05
DEFAULT_CAPEX_PCT = 0.04
DEFAULT_WC_CHANGE_PCT = 0.02
DEFAULT_TAX_RATE = 0.21
DEFAULT_WACC = 0.09
DEFAULT_TERMINAL_GROWTH = 0.025
GROWTH_CAP = 0.15

# Sectors where DCF is not the textbook methodology — DDM and comparables
# are typically used instead. We still compute the DCF, but tag the result
# so the UI can warn the user.
FINANCIAL_SECTORS_REQUIRING_WARNING = {
    "Financial Services",
    "Real Estate",
}
_SECTOR_WARNING_MESSAGE = (
    "DCF is generally not the standard valuation methodology for financial "
    "institutions and REITs. For these sectors, Trading Comparables "
    "(peer-based multiples) and Dividend Discount Models are typically more "
    "reliable. Treat these DCF outputs as illustrative only."
)


class DCFValuator:
    """Compute a 5-year DCF valuation from a financials bundle."""

    def compute_assumptions_from_history(self, financials: dict[str, Any]) -> dict[str, Any]:
        """Derive baseline DCF assumptions from historical income statement and cash flow."""
        warnings: list[str] = []
        income: list[dict[str, Any]] = financials.get("income_statement") or []
        cashflow: list[dict[str, Any]] = financials.get("cash_flow") or []
        balance: list[dict[str, Any]] = financials.get("balance_sheet") or []
        profile: dict[str, Any] = financials.get("profile") or {}

        terminal_growth = DEFAULT_TERMINAL_GROWTH

        raw_cagr = self._revenue_cagr(income, warnings)
        # Diagnostic: show the un-capped/un-floored CAGR so we can sanity-check the model input.
        logger.info("raw historical 3y revenue CAGR: %.4f%%", raw_cagr * 100)

        # Floor at terminal+1% so the schedule always declines toward terminal instead of
        # sitting flat when the historical CAGR happens to be below terminal growth.
        growth_floor = terminal_growth + 0.01
        y1 = max(min(raw_cagr, GROWTH_CAP), growth_floor)
        # Year 2 dips ~20% of the way from Y1 toward terminal, then Y3-Y5 interpolate linearly.
        y2 = y1 - (y1 - terminal_growth) * 0.2
        y3 = y2 + (terminal_growth - y2) * (1 / 3)
        y4 = y2 + (terminal_growth - y2) * (2 / 3)
        y5 = terminal_growth
        growth_rates = [y1, y2, y3, y4, y5]

        ebit_margin, ebit_field = self._three_year_avg_ratio(
            income, income, EBIT_KEYS, default=DEFAULT_EBIT_MARGIN,
            warnings=warnings, label="EBIT margin",
        )
        if ebit_field:
            logger.info("EBIT margin source field: '%s'", ebit_field)
        da_pct, _ = self._three_year_avg_ratio(
            cashflow, income, DA_KEYS, default=DEFAULT_DA_PCT,
            warnings=warnings, label="D&A % of revenue",
        )
        capex_pct, _ = self._three_year_avg_ratio(
            cashflow, income, CAPEX_KEYS, default=DEFAULT_CAPEX_PCT,
            warnings=warnings, label="CapEx % of revenue", absolute=True,
        )
        # FMP reports changeInWorkingCapital as negative when WC increases
        # (cash consumed). For FCFF we need the opposite sign: positive when
        # cash is consumed, so we negate at the boundary.
        wc_change_pct, _ = self._three_year_avg_ratio(
            cashflow, income, WC_CHANGE_KEYS, default=DEFAULT_WC_CHANGE_PCT,
            warnings=warnings, label="Change in WC % of revenue", negate=True,
        )

        # Sanity check: anomalous EBIT margin. Informational only — the
        # downstream projection uses the value as-computed so the user can
        # still see what the math produces, but the warning makes it clear
        # the DCF output should be taken with extra skepticism.
        if ebit_margin < 0.0:
            warnings.append(
                f"Derived EBIT margin is negative ({ebit_margin:.1%}). The "
                "company was unprofitable on average over the last 3 years — "
                "DCF output will be unreliable."
            )
        elif ebit_margin < 0.02:
            warnings.append(
                f"Derived EBIT margin is very low ({ebit_margin:.1%}), typical "
                "of thin-margin sectors like retail. DCF tends to undervalue "
                "these businesses — cross-check with Trading Comparables."
            )
        elif ebit_margin > 0.60:
            warnings.append(
                f"Derived EBIT margin is unusually high ({ebit_margin:.1%}). "
                "Verify the historical data is not distorted by one-off items."
            )

        # Sanity check: cash-flow ratios occasionally come out wild (e.g., a
        # huge one-off CapEx year), which would break the projection. Clamp
        # them into sane bounds and surface the adjustment.
        da_pct = self._clamp_with_warning(
            da_pct, 0.0, 0.25, "D&A as % of revenue", warnings
        )
        capex_pct = self._clamp_with_warning(
            capex_pct, 0.0, 0.30, "CapEx as % of revenue", warnings
        )
        wc_change_pct = self._clamp_with_warning(
            wc_change_pct, -0.15, 0.15, "Change in WC % of revenue", warnings
        )

        # Effective tax rate from latest income statement, clamped to [0%, 35%].
        tax_rate = DEFAULT_TAX_RATE
        if income:
            pretax = income[0].get("pretax_income")
            tax = income[0].get("income_tax")
            if pretax and pretax > 0 and tax is not None:
                derived = tax / pretax
                tax_rate = max(0.0, min(0.35, derived))

        # WACC from CAPM cost of equity + debt-weighted cost of debt.
        latest_balance = balance[0] if balance else {}
        latest_income = income[0] if income else {}
        wacc_result = compute_wacc(
            market_cap=profile.get("market_cap"),
            total_debt=latest_balance.get("total_debt"),
            beta=profile.get("beta"),
            interest_expense=latest_income.get("interest_expense"),
            tax_rate=tax_rate,
        )
        wacc = wacc_result["wacc"] if wacc_result["wacc"] is not None else DEFAULT_WACC
        wacc_breakdown = wacc_result.get("breakdown")
        if wacc_result.get("warning"):
            warnings.append(
                f"WACC computation fell back to default {DEFAULT_WACC:.2%}: "
                f"{wacc_result['warning']}"
            )

        return {
            "revenue_growth_rates": growth_rates,
            "ebit_margin": ebit_margin,
            "tax_rate": tax_rate,
            "da_pct_revenue": da_pct,
            "capex_pct_revenue": capex_pct,
            "wc_change_pct_revenue": wc_change_pct,
            "wacc": wacc,
            "wacc_breakdown": wacc_breakdown,
            "terminal_growth_rate": terminal_growth,
            "historical_cagr_3y": raw_cagr,
            "ebit_source_field": ebit_field,
            "warnings": warnings,
        }

    def run_dcf(
        self, financials: dict[str, Any], assumptions: dict[str, Any]
    ) -> dict[str, Any]:
        """Project 5 years of FCFF, discount, and back into per-share value."""
        assumptions_used = dict(assumptions)
        wacc: float = assumptions_used["wacc"]
        terminal_growth: float = assumptions_used["terminal_growth_rate"]
        if wacc <= terminal_growth:
            raise ValueError(
                f"WACC ({wacc:.2%}) must be greater than terminal growth ({terminal_growth:.2%})"
            )
        if not math.isfinite(wacc) or not math.isfinite(terminal_growth):
            raise ValueError("WACC and terminal growth must be finite numbers")

        warnings: list[str] = list(assumptions_used.get("warnings", []))

        income: list[dict[str, Any]] = financials.get("income_statement") or []
        balance: list[dict[str, Any]] = financials.get("balance_sheet") or []
        profile: dict[str, Any] = financials.get("profile") or {}

        if not income:
            raise ValueError("Income statement is empty; cannot run DCF")
        latest_revenue = income[0].get(REVENUE_KEY)
        if latest_revenue is None or latest_revenue <= 0:
            raise ValueError("Latest revenue is missing or non-positive")

        growth_rates: list[float] = assumptions_used["revenue_growth_rates"]
        if len(growth_rates) < 5:
            raise ValueError("DCF requires five revenue growth rates")
        if any((not math.isfinite(rate)) or rate <= -0.95 for rate in growth_rates[:5]):
            raise ValueError("Revenue growth assumptions are outside supported bounds")

        ebit_margin: float = assumptions_used["ebit_margin"]
        tax_rate: float = assumptions_used["tax_rate"]
        da_pct: float = assumptions_used["da_pct_revenue"]
        capex_pct: float = assumptions_used["capex_pct_revenue"]
        wc_pct: float = assumptions_used["wc_change_pct_revenue"]

        projections: list[dict[str, Any]] = []
        revenue = float(latest_revenue)
        for year in range(1, 6):
            revenue = revenue * (1 + growth_rates[year - 1])
            ebit = revenue * ebit_margin
            nopat = ebit * (1 - tax_rate)
            fcff = nopat + revenue * da_pct - revenue * capex_pct - revenue * wc_pct
            pv_fcff = fcff / (1 + wacc) ** year
            projections.append({
                "year": year,
                "revenue": revenue,
                "ebit": ebit,
                "nopat": nopat,
                "fcff": fcff,
                "pv_fcff": pv_fcff,
            })

        fcff_year5 = projections[-1]["fcff"]
        terminal_value = fcff_year5 * (1 + terminal_growth) / (wacc - terminal_growth)
        pv_terminal_value = terminal_value / (1 + wacc) ** 5
        enterprise_value = sum(p["pv_fcff"] for p in projections) + pv_terminal_value

        total_debt = self._first_value(balance[0] if balance else {}, TOTAL_DEBT_KEYS)
        cash = self._first_value(balance[0] if balance else {}, CASH_KEYS)
        if total_debt is None:
            total_debt = 0.0
            warnings.append("Total Debt missing on latest balance sheet; assumed 0")
        if cash is None:
            cash = 0.0
            warnings.append("Cash missing on latest balance sheet; assumed 0")
        net_debt = float(total_debt) - float(cash)
        equity_value = enterprise_value - net_debt

        shares_outstanding = profile.get("shares_outstanding")
        if shares_outstanding and shares_outstanding > 0:
            per_share_value: float | None = equity_value / shares_outstanding
        else:
            per_share_value = None
            warnings.append("Shares outstanding missing; per-share value unavailable")

        current_price = profile.get("price")
        if per_share_value is not None and current_price:
            upside_pct: float | None = (per_share_value - current_price) / current_price
        else:
            upside_pct = None

        # Sanity check: extreme divergence between DCF intrinsic and market
        # price is almost always a signal that the model is the wrong tool,
        # not that the market is wildly mispricing. Informational only — the
        # per-share value and upside are still returned exactly as computed.
        if upside_pct is not None:
            if upside_pct < -0.80:
                warnings.append(
                    "DCF intrinsic value is more than 80% below market price. "
                    "This usually means the DCF model is not well-suited to "
                    "this company — common for high-growth, asset-light, or "
                    "platform businesses whose value is not captured by "
                    "historical free cash flow. Trading Comparables are likely "
                    "more meaningful here."
                )
            elif upside_pct > 1.50:
                warnings.append(
                    "DCF intrinsic value is more than 150% above market price. "
                    "Verify the growth and margin assumptions — the model may "
                    "be extrapolating an unsustainable trend."
                )

        # Narrow corner sweep around the base (wacc, terminal_growth) to give
        # the football field a low/high range. Pure math via _per_share_for —
        # no recursion, no warning side effects. Corners that hit invalid math
        # (e.g. tweaked tg ≥ tweaked wacc) are simply dropped.
        corner_values: list[float] = []
        for w_corner in (wacc - 0.01, wacc + 0.01):
            for tg_corner in (terminal_growth - 0.005, terminal_growth + 0.005):
                v = self._per_share_for(financials, assumptions, w_corner, tg_corner)
                if v is not None:
                    corner_values.append(v)
        if len(corner_values) >= 2:
            assumptions_used["per_share_low"] = min(corner_values)
            assumptions_used["per_share_high"] = max(corner_values)
        else:
            assumptions_used["per_share_low"] = None
            assumptions_used["per_share_high"] = None

        sector = (profile.get("sector") or "").strip()
        sector_warning: dict[str, str] | None = None
        if sector in FINANCIAL_SECTORS_REQUIRING_WARNING:
            sector_warning = {
                "type": "dcf_unsuitable",
                "message": _SECTOR_WARNING_MESSAGE,
            }

        return {
            "projections": projections,
            "terminal_value": terminal_value,
            "pv_terminal_value": pv_terminal_value,
            "enterprise_value": enterprise_value,
            "net_debt": net_debt,
            "equity_value": equity_value,
            "shares_outstanding": shares_outstanding,
            "per_share_value": per_share_value,
            "current_price": current_price,
            "upside_pct": upside_pct,
            "assumptions_used": assumptions_used,
            "wacc_breakdown": assumptions_used.get("wacc_breakdown"),
            "warnings": warnings,
            "sector_warning": sector_warning,
        }

    def reverse_dcf(
        self,
        financials: dict[str, Any],
        assumptions: dict[str, Any],
        target_price: float | None = None,
    ) -> dict[str, Any]:
        """Solve for the revenue growth rate that justifies a given price.

        Uses binary search on a uniform Y1-Y5 growth rate to find the growth
        that makes the DCF fair value equal the current (or specified) price.
        Returns the implied growth rate, margin of safety, and interpretation.
        """
        profile: dict[str, Any] = financials.get("profile") or {}
        price = target_price or profile.get("price")
        if price is None or price <= 0:
            raise ValueError("No market price available for reverse DCF")

        lo, hi = -0.10, 0.50
        fair_lo = self._fair_value_for_uniform_growth(financials, assumptions, lo)
        fair_hi = self._fair_value_for_uniform_growth(financials, assumptions, hi)

        solver_status = "solved"
        implied_growth: float | None = None

        if fair_lo is not None and fair_hi is not None and fair_lo <= fair_hi:
            if price <= fair_lo:
                implied_growth = lo
                solver_status = "below_range"
            elif price >= fair_hi:
                implied_growth = hi
                solver_status = "above_range"
            else:
                low_bound = lo
                high_bound = hi
                for _ in range(80):
                    mid = (low_bound + high_bound) / 2.0
                    fair = self._fair_value_for_uniform_growth(
                        financials,
                        assumptions,
                        mid,
                    )
                    if fair is None:
                        high_bound = mid
                        continue
                    if fair < price:
                        low_bound = mid
                    else:
                        high_bound = mid
                    if abs(fair - price) / price < 0.001:
                        implied_growth = mid
                        break
                if implied_growth is None:
                    implied_growth = (low_bound + high_bound) / 2.0
        else:
            # If negative or unstable FCFF makes the growth/value relationship
            # non-monotonic, keep the response explicit instead of pretending
            # the reverse DCF can be solved cleanly.
            implied_growth = assumptions["revenue_growth_rates"][0]
            solver_status = "unstable"

        # Also compute with base assumptions for comparison
        base_result = self.run_dcf(financials, assumptions)
        base_fair = base_result.get("per_share_value")

        # Margin of safety
        if base_fair is not None and price > 0:
            margin_of_safety = (base_fair - price) / price
        else:
            margin_of_safety = None

        # Interpretation
        if margin_of_safety is not None:
            if solver_status == "above_range":
                interpretation = (
                    "Market price requires revenue growth above the solver range. "
                    "Treat the implied rate as a lower-bound stress case."
                )
            elif solver_status == "below_range":
                interpretation = (
                    "Market price is justified even at the solver's low-growth bound. "
                    "The reverse DCF is not growth-constrained at this price."
                )
            elif solver_status == "unstable":
                interpretation = (
                    "Reverse DCF is unstable because the projected cash-flow profile "
                    "does not produce a clean growth-to-value relationship."
                )
            elif margin_of_safety > 0.20:
                interpretation = "Significant upside — market may be under-pricing growth"
            elif margin_of_safety > 0:
                interpretation = "Modest upside — fairly valued with some room"
            elif margin_of_safety > -0.20:
                interpretation = "Near fair value — small premium to intrinsic"
            else:
                interpretation = "Trading above DCF value — market prices higher growth"
        else:
            interpretation = "Insufficient data for interpretation"

        return {
            "implied_growth_rate": implied_growth,
            "target_price": price,
            "base_assumptions_growth": assumptions["revenue_growth_rates"][0] if assumptions.get("revenue_growth_rates") else None,
            "base_fair_value": base_fair,
            "margin_of_safety": margin_of_safety,
            "interpretation": interpretation,
            "wacc": assumptions.get("wacc"),
            "terminal_growth_rate": assumptions.get("terminal_growth_rate"),
            "solver_status": solver_status,
            "growth_floor": lo,
            "growth_ceiling": hi,
            "fair_value_at_growth_floor": fair_lo,
            "fair_value_at_growth_ceiling": fair_hi,
        }

    def sensitivity_table(
        self,
        financials: dict[str, Any],
        base_assumptions: dict[str, Any],
        wacc_range: list[float],
        terminal_growth_range: list[float],
    ) -> dict[str, Any]:
        """Build a per-share-value matrix across WACC × terminal-growth combinations."""
        matrix: list[list[float | None]] = []
        for wacc in wacc_range:
            row: list[float | None] = []
            for tg in terminal_growth_range:
                if wacc <= tg:
                    row.append(None)
                    continue
                tweaked = dict(base_assumptions)
                tweaked["wacc"] = wacc
                tweaked["terminal_growth_rate"] = tg
                try:
                    result = self.run_dcf(financials, tweaked)
                    row.append(result["per_share_value"])
                except (ValueError, ZeroDivisionError):
                    row.append(None)
            matrix.append(row)

        return {
            "wacc_values": list(wacc_range),
            "terminal_growth_values": list(terminal_growth_range),
            "matrix": matrix,
        }

    def _per_share_for(
        self,
        financials: dict[str, Any],
        assumptions: dict[str, Any],
        wacc: float,
        terminal_growth: float,
    ) -> float | None:
        """Pure DCF math: projection → terminal value → EV → equity → per share.

        Used by the narrow corner sweep that produces the football-field range.
        Returns None on any condition that would otherwise raise (wacc ≤ tg,
        missing revenue, missing shares, etc.) so the caller can simply drop
        that corner. Does NOT touch warnings, sanity checks, or recursion.
        """
        if wacc <= terminal_growth:
            return None

        income = financials.get("income_statement") or []
        balance = financials.get("balance_sheet") or []
        profile = financials.get("profile") or {}
        if not income:
            return None
        latest_revenue = income[0].get(REVENUE_KEY)
        if latest_revenue is None or latest_revenue <= 0:
            return None

        try:
            growth_rates: list[float] = assumptions["revenue_growth_rates"]
            ebit_margin: float = assumptions["ebit_margin"]
            tax_rate: float = assumptions["tax_rate"]
            da_pct: float = assumptions["da_pct_revenue"]
            capex_pct: float = assumptions["capex_pct_revenue"]
            wc_pct: float = assumptions["wc_change_pct_revenue"]
        except KeyError:
            return None

        revenue = float(latest_revenue)
        pv_sum = 0.0
        fcff_year5 = 0.0
        for year in range(1, 6):
            revenue = revenue * (1 + growth_rates[year - 1])
            ebit = revenue * ebit_margin
            nopat = ebit * (1 - tax_rate)
            fcff = nopat + revenue * da_pct - revenue * capex_pct - revenue * wc_pct
            pv_sum += fcff / (1 + wacc) ** year
            fcff_year5 = fcff

        terminal_value = fcff_year5 * (1 + terminal_growth) / (wacc - terminal_growth)
        pv_terminal = terminal_value / (1 + wacc) ** 5
        enterprise_value = pv_sum + pv_terminal

        total_debt = self._first_value(balance[0] if balance else {}, TOTAL_DEBT_KEYS) or 0.0
        cash = self._first_value(balance[0] if balance else {}, CASH_KEYS) or 0.0
        equity_value = enterprise_value - (float(total_debt) - float(cash))

        shares = profile.get("shares_outstanding")
        if not shares or shares <= 0:
            return None
        return equity_value / float(shares)

    def _fair_value_for_uniform_growth(
        self,
        financials: dict[str, Any],
        assumptions: dict[str, Any],
        growth_rate: float,
    ) -> float | None:
        test_assumptions = dict(assumptions)
        test_assumptions["revenue_growth_rates"] = [growth_rate] * 5
        try:
            result = self.run_dcf(financials, test_assumptions)
        except (ValueError, ZeroDivisionError):
            return None
        fair = result.get("per_share_value")
        if fair is None or not math.isfinite(fair):
            return None
        return fair

    @staticmethod
    def _clamp_with_warning(
        value: float,
        low: float,
        high: float,
        label: str,
        warnings: list[str],
    ) -> float:
        """Clamp `value` into [low, high]; append a warning only if it bit.

        Used to bound D&A / CapEx / WC ratios when historical data produces
        out-of-range numbers (e.g., a one-off restructuring quarter that
        balloons CapEx to 40% of revenue). The clamped value flows into the
        projection so the model stays well-behaved; the warning surfaces the
        adjustment to the user.
        """
        if value < low:
            warnings.append(
                f"{label} ({value:.1%}) is outside the expected range and "
                f"was capped at {low:.1%}."
            )
            return low
        if value > high:
            warnings.append(
                f"{label} ({value:.1%}) is outside the expected range and "
                f"was capped at {high:.1%}."
            )
            return high
        return value

    @staticmethod
    def _first_value(record: dict[str, Any], keys: tuple[str, ...]) -> float | None:
        for key in keys:
            value = record.get(key)
            if value is not None:
                try:
                    return float(value)
                except (TypeError, ValueError):
                    continue
        return None

    def _revenue_cagr(
        self, income: list[dict[str, Any]], warnings: list[str]
    ) -> float:
        try:
            revenues = [
                row.get(REVENUE_KEY)
                for row in income
                if row.get(REVENUE_KEY) is not None
            ]
            if len(revenues) < 2:
                warnings.append("Insufficient revenue history; using terminal growth as CAGR")
                return DEFAULT_TERMINAL_GROWTH

            # Use up to 4 data points (3 periods) for a 3-year CAGR.
            points = revenues[:4]
            start = float(points[-1])
            end = float(points[0])
            periods = len(points) - 1
            if start <= 0 or end <= 0:
                warnings.append("Non-positive revenue in history; using terminal growth as CAGR")
                return DEFAULT_TERMINAL_GROWTH
            return (end / start) ** (1 / periods) - 1
        except (TypeError, ValueError, ZeroDivisionError):
            warnings.append("Failed to compute revenue CAGR; using terminal growth fallback")
            return DEFAULT_TERMINAL_GROWTH

    def _three_year_avg_ratio(
        self,
        statement: list[dict[str, Any]],
        income: list[dict[str, Any]],
        metric_keys: tuple[str, ...],
        default: float,
        warnings: list[str],
        label: str,
        absolute: bool = False,
        negate: bool = False,
    ) -> tuple[float, str | None]:
        try:
            revenue_by_date: dict[str, float] = {}
            for row in income:
                date = row.get("date")
                rev = row.get(REVENUE_KEY)
                if date and rev:
                    revenue_by_date[str(date)] = float(rev)

            ratios: list[float] = []
            field_used: str | None = None
            for row in statement[:3]:
                date = str(row.get("date")) if row.get("date") else None
                rev = revenue_by_date.get(date) if date else None
                if not rev:
                    continue
                value, key = self._first_value_with_key(row, metric_keys)
                if value is None:
                    continue
                if field_used is None:
                    field_used = key
                if absolute:
                    value = abs(value)
                if negate:
                    value = -value
                ratios.append(value / rev)

            if not ratios:
                warnings.append(f"{label} unavailable; using default {default:.2%}")
                return default, None
            return sum(ratios) / len(ratios), field_used
        except (TypeError, ValueError, ZeroDivisionError):
            warnings.append(f"Failed to compute {label}; using default {default:.2%}")
            return default, None

    @staticmethod
    def _first_value_with_key(
        record: dict[str, Any], keys: tuple[str, ...]
    ) -> tuple[float | None, str | None]:
        for key in keys:
            value = record.get(key)
            if value is not None:
                try:
                    return float(value), key
                except (TypeError, ValueError):
                    continue
        return None, None


if __name__ == "__main__":
    from app.services.data_fetcher import FinancialDataFetcher

    fetcher = FinancialDataFetcher()
    valuator = DCFValuator()

    print("Fetching AAPL financials...")
    financials = fetcher.get_all_for_ticker("AAPL")
    if financials is None:
        raise SystemExit("Ticker AAPL not found on FMP")

    assumptions = valuator.compute_assumptions_from_history(financials)
    result = valuator.run_dcf(financials, assumptions)

    price = result["current_price"]
    psv = result["per_share_value"]
    upside = result["upside_pct"]

    print("\n=== DCF Result (AAPL) ===")
    print(f"Current Price:       {price}")
    print(f"Per-Share Value:     {psv:,.2f}" if psv is not None else "Per-Share Value:     n/a")
    print(f"Upside:              {upside:.1%}" if upside is not None else "Upside:              n/a")
    print(f"Enterprise Value:    {result['enterprise_value']:,.0f}")
    print(f"Net Debt:            {result['net_debt']:,.0f}")
    print(f"Equity Value:        {result['equity_value']:,.0f}")

    print("\n=== Key Assumptions ===")
    rates = assumptions["revenue_growth_rates"]
    print("Revenue Growth (Y1-Y5): " + ", ".join(f"{r:.2%}" for r in rates))
    print(f"EBIT Margin:           {assumptions['ebit_margin']:.2%}")
    print(f"Tax Rate:              {assumptions['tax_rate']:.2%}")
    print(f"D&A % Revenue:         {assumptions['da_pct_revenue']:.2%}")
    print(f"CapEx % Revenue:       {assumptions['capex_pct_revenue']:.2%}")
    print(f"WC Change % Revenue:   {assumptions['wc_change_pct_revenue']:.2%}")
    print(f"WACC:                  {assumptions['wacc']:.2%}")
    print(f"Terminal Growth:       {assumptions['terminal_growth_rate']:.2%}")

    if result["warnings"]:
        print("\n=== Warnings ===")
        for w in result["warnings"]:
            print(f"- {w}")

    sensitivity = valuator.sensitivity_table(
        financials,
        assumptions,
        wacc_range=[0.07, 0.08, 0.09, 0.10, 0.11],
        terminal_growth_range=[0.02, 0.025, 0.03],
    )

    print("\n=== Sensitivity (Per-Share Value) ===")
    tg_values = sensitivity["terminal_growth_values"]
    header = "WACC \\ g".ljust(12) + "".join(f"{tg:>10.2%}" for tg in tg_values)
    print(header)
    for wacc, row in zip(sensitivity["wacc_values"], sensitivity["matrix"]):
        cells = "".join(
            f"{v:>10.2f}" if v is not None else f"{'n/a':>10}" for v in row
        )
        print(f"{wacc:>10.2%}  {cells}")
