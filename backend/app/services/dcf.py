"""Simplified 5-year DCF valuation built on FMP-normalized financials."""

from typing import Any


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


class DCFValuator:
    """Compute a 5-year DCF valuation from a financials bundle."""

    def compute_assumptions_from_history(self, financials: dict[str, Any]) -> dict[str, Any]:
        """Derive baseline DCF assumptions from historical income statement and cash flow."""
        warnings: list[str] = []
        income: list[dict[str, Any]] = financials.get("income_statement") or []
        cashflow: list[dict[str, Any]] = financials.get("cash_flow") or []

        terminal_growth = DEFAULT_TERMINAL_GROWTH

        raw_cagr = self._revenue_cagr(income, warnings)
        # Diagnostic: show the un-capped/un-floored CAGR so we can sanity-check the model input.
        print(f"[dcf] raw historical 3y revenue CAGR: {raw_cagr:.4%}")

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
            print(f"[dcf] EBIT margin source field: '{ebit_field}'")
        da_pct, _ = self._three_year_avg_ratio(
            cashflow, income, DA_KEYS, default=DEFAULT_DA_PCT,
            warnings=warnings, label="D&A % of revenue",
        )
        capex_pct, _ = self._three_year_avg_ratio(
            cashflow, income, CAPEX_KEYS, default=DEFAULT_CAPEX_PCT,
            warnings=warnings, label="CapEx % of revenue", absolute=True,
        )
        wc_change_pct, _ = self._three_year_avg_ratio(
            cashflow, income, WC_CHANGE_KEYS, default=DEFAULT_WC_CHANGE_PCT,
            warnings=warnings, label="Change in WC % of revenue",
        )

        return {
            "revenue_growth_rates": growth_rates,
            "ebit_margin": ebit_margin,
            "tax_rate": DEFAULT_TAX_RATE,
            "da_pct_revenue": da_pct,
            "capex_pct_revenue": capex_pct,
            "wc_change_pct_revenue": wc_change_pct,
            "wacc": DEFAULT_WACC,
            "terminal_growth_rate": terminal_growth,
            "historical_cagr_3y": raw_cagr,
            "ebit_source_field": ebit_field,
            "warnings": warnings,
        }

    def run_dcf(
        self, financials: dict[str, Any], assumptions: dict[str, Any]
    ) -> dict[str, Any]:
        """Project 5 years of FCFF, discount, and back into per-share value."""
        wacc: float = assumptions["wacc"]
        terminal_growth: float = assumptions["terminal_growth_rate"]
        if wacc <= terminal_growth:
            raise ValueError(
                f"WACC ({wacc:.2%}) must be greater than terminal growth ({terminal_growth:.2%})"
            )

        warnings: list[str] = list(assumptions.get("warnings", []))

        income: list[dict[str, Any]] = financials.get("income_statement") or []
        balance: list[dict[str, Any]] = financials.get("balance_sheet") or []
        profile: dict[str, Any] = financials.get("profile") or {}

        if not income:
            raise ValueError("Income statement is empty; cannot run DCF")
        latest_revenue = income[0].get(REVENUE_KEY)
        if latest_revenue is None or latest_revenue <= 0:
            raise ValueError("Latest revenue is missing or non-positive")

        growth_rates: list[float] = assumptions["revenue_growth_rates"]
        ebit_margin: float = assumptions["ebit_margin"]
        tax_rate: float = assumptions["tax_rate"]
        da_pct: float = assumptions["da_pct_revenue"]
        capex_pct: float = assumptions["capex_pct_revenue"]
        wc_pct: float = assumptions["wc_change_pct_revenue"]

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
            "assumptions_used": assumptions,
            "warnings": warnings,
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
