"""Trading-multiples valuation: target's own ratios plus peer-based implied values."""

import statistics
from typing import Any, ClassVar

from app.services.data_fetcher import FinancialDataFetcher


TOTAL_DEBT_KEYS = ("total_debt",)
CASH_KEYS = ("cash",)
EQUITY_KEYS = ("stockholder_equity",)
EBITDA_KEYS = ("ebitda",)
EBIT_KEYS = ("ebit", "operating_income")
DA_KEYS = ("da",)

RATIO_METRICS = ("pe_ratio", "ev_ebitda", "ev_sales", "p_book")


class MultiplesValuator:
    """Compute trading multiples for a target and peer-implied valuations."""

    PEER_MAP: ClassVar[dict[str, list[str]]] = {
        "AAPL": ["MSFT", "GOOGL", "META", "AMZN"],
        "MSFT": ["AAPL", "GOOGL", "ORCL", "CRM"],
        "GOOGL": ["META", "MSFT", "AMZN", "AAPL"],
        "META": ["GOOGL", "SNAP", "PINS"],
        "AMZN": ["WMT", "COST", "TGT", "EBAY"],
        "TSLA": ["F", "GM", "RIVN", "STLA"],
        "NVDA": ["AMD", "INTC", "AVGO", "QCOM"],
        "JPM": ["BAC", "C", "WFC", "GS"],
        "KO": ["PEP", "MNST", "KDP"],
        "WMT": ["TGT", "COST", "AMZN"],
    }

    def __init__(self, fetcher: FinancialDataFetcher | None = None) -> None:
        self.fetcher = fetcher or FinancialDataFetcher()

    def compute_multiples(self, ticker: str) -> dict[str, Any]:
        """Compute trading multiples for a single ticker from the latest fiscal year."""
        financials = self.fetcher.get_all_for_ticker(ticker)
        if financials is None:
            raise ValueError(f"Ticker '{ticker}' not found")

        profile = financials.get("profile") or {}
        income = financials.get("income_statement") or []
        balance = financials.get("balance_sheet") or []
        cashflow = financials.get("cash_flow") or []
        key_metrics_ttm = financials.get("key_metrics_ttm") or {}
        ratios_ttm = financials.get("ratios_ttm") or {}

        if not income or not balance:
            raise ValueError(f"Insufficient financial data for {ticker}")

        latest_income = income[0]
        latest_balance = balance[0]
        latest_cashflow = cashflow[0] if cashflow else {}

        market_cap = self._to_float(profile.get("market_cap"))
        shares = self._to_float(profile.get("shares_outstanding"))
        price = self._to_float(profile.get("price"))

        total_debt = self._first_value(latest_balance, TOTAL_DEBT_KEYS) or 0.0
        cash = self._first_value(latest_balance, CASH_KEYS) or 0.0
        equity = self._first_value(latest_balance, EQUITY_KEYS)
        net_debt = total_debt - cash

        revenue = self._to_float(latest_income.get("revenue"))
        net_income = self._to_float(latest_income.get("net_income"))

        ebitda = self._first_value(latest_income, EBITDA_KEYS)
        if ebitda is None:
            ebit = self._first_value(latest_income, EBIT_KEYS)
            da = self._first_value(latest_income, DA_KEYS)
            if da is None:
                da = self._first_value(latest_cashflow, DA_KEYS)
            if ebit is not None and da is not None:
                ebitda = ebit + abs(da)

        # Prefer FMP's TTM enterprise value when available; fall back to derived.
        enterprise_value = self._to_float(key_metrics_ttm.get("enterprise_value"))
        if enterprise_value is None and market_cap is not None:
            enterprise_value = market_cap + total_debt - cash

        # P/E and P/Book live on the ratios-ttm endpoint (no longer on profile or key-metrics-ttm).
        pe_ratio = self._to_float(ratios_ttm.get("pe_ratio"))
        if pe_ratio is None:
            pe_ratio = self._safe_div(market_cap, net_income)

        ev_ebitda = self._to_float(key_metrics_ttm.get("ev_ebitda"))
        if ev_ebitda is None:
            ev_ebitda = self._safe_div(enterprise_value, ebitda)

        ev_sales = self._to_float(key_metrics_ttm.get("ev_sales"))
        if ev_sales is None:
            ev_sales = self._safe_div(enterprise_value, revenue)

        p_book = self._to_float(ratios_ttm.get("p_book"))
        if p_book is None:
            p_book = self._safe_div(market_cap, equity)

        return {
            "ticker": ticker.upper(),
            "symbol": profile.get("symbol") or ticker.upper(),
            "name": profile.get("name"),
            "market_cap": market_cap,
            "enterprise_value": enterprise_value,
            "revenue": revenue,
            "ebitda": ebitda,
            "net_income": net_income,
            "total_debt": total_debt,
            "cash": cash,
            "net_debt": net_debt,
            "stockholder_equity": equity,
            "shares_outstanding": shares,
            "price": price,
            "pe_ratio": pe_ratio,
            "ev_ebitda": ev_ebitda,
            "ev_sales": ev_sales,
            "p_book": p_book,
        }

    def get_peers(self, ticker: str, custom_peers: list[str] | None = None) -> list[str]:
        """Return the peer list, preferring custom_peers when provided."""
        if custom_peers is not None:
            return [p.upper() for p in custom_peers]
        return list(self.PEER_MAP.get(ticker.upper(), []))

    def compute_peer_statistics(self, peer_tickers: list[str]) -> dict[str, Any]:
        """Compute multiples for each peer and aggregate median/mean/min/max."""
        peers: list[dict[str, Any]] = []
        for peer in peer_tickers:
            try:
                peers.append(self.compute_multiples(peer))
            except Exception as exc:
                print(f"[multiples] skipped peer {peer}: {exc}")

        stats: dict[str, dict[str, Any]] = {}
        for metric in RATIO_METRICS:
            values = [
                p[metric]
                for p in peers
                if p.get(metric) is not None and p[metric] > 0
            ]
            if values:
                stats[metric] = {
                    "median": statistics.median(values),
                    "mean": statistics.mean(values),
                    "min": min(values),
                    "max": max(values),
                    "count": len(values),
                }
            else:
                stats[metric] = {
                    "median": None,
                    "mean": None,
                    "min": None,
                    "max": None,
                    "count": 0,
                }
        return {"peers": peers, "statistics": stats}

    def valuate_with_multiples(
        self, ticker: str, custom_peers: list[str] | None = None
    ) -> dict[str, Any]:
        """Run a full multiples valuation for a target against its peers."""
        target = self.compute_multiples(ticker)
        peer_tickers = self.get_peers(ticker, custom_peers)
        peer_data = self.compute_peer_statistics(peer_tickers)
        stats = peer_data["statistics"]

        shares = target.get("shares_outstanding")
        net_debt = target.get("net_debt") or 0.0

        implied_valuations = {
            "pe_based": self._implied_from_equity_multiple(
                metric_value=target.get("net_income"),
                multiple=stats["pe_ratio"]["median"],
                shares=shares,
            ),
            "ev_ebitda_based": self._implied_from_ev_multiple(
                metric_value=target.get("ebitda"),
                multiple=stats["ev_ebitda"]["median"],
                net_debt=net_debt,
                shares=shares,
            ),
            "ev_sales_based": self._implied_from_ev_multiple(
                metric_value=target.get("revenue"),
                multiple=stats["ev_sales"]["median"],
                net_debt=net_debt,
                shares=shares,
            ),
        }

        return {
            "target_metrics": target,
            "peer_statistics": peer_data,
            "implied_valuations": implied_valuations,
            "current_price": target.get("price"),
            "peers_used": [p["symbol"] for p in peer_data["peers"]],
        }

    @staticmethod
    def _to_float(value: Any) -> float | None:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

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

    @staticmethod
    def _safe_div(numerator: float | None, denominator: float | None) -> float | None:
        if numerator is None or denominator is None:
            return None
        if denominator <= 0:
            return None
        return numerator / denominator

    @staticmethod
    def _implied_from_equity_multiple(
        metric_value: float | None, multiple: float | None, shares: float | None
    ) -> dict[str, Any] | None:
        if metric_value is None or metric_value <= 0 or not multiple:
            return None
        implied_market_cap = metric_value * multiple
        implied_per_share = implied_market_cap / shares if shares else None
        return {
            "implied_market_cap": implied_market_cap,
            "implied_per_share": implied_per_share,
            "multiple_used": multiple,
        }

    @staticmethod
    def _implied_from_ev_multiple(
        metric_value: float | None,
        multiple: float | None,
        net_debt: float,
        shares: float | None,
    ) -> dict[str, Any] | None:
        if metric_value is None or metric_value <= 0 or not multiple:
            return None
        implied_ev = metric_value * multiple
        implied_market_cap = implied_ev - net_debt
        implied_per_share = implied_market_cap / shares if shares else None
        return {
            "implied_enterprise_value": implied_ev,
            "implied_market_cap": implied_market_cap,
            "implied_per_share": implied_per_share,
            "multiple_used": multiple,
        }


def _fmt(value: Any, spec: str = ",.2f") -> str:
    if value is None:
        return "n/a"
    try:
        return format(value, spec)
    except (TypeError, ValueError):
        return str(value)


if __name__ == "__main__":
    valuator = MultiplesValuator()

    print("Computing multiples valuation for AAPL...")
    result = valuator.valuate_with_multiples("AAPL")

    target = result["target_metrics"]
    print(f"\n=== Target: {target['symbol']} ({target['name']}) ===")
    print(f"Market Cap:        {_fmt(target['market_cap'], ',.0f')}")
    print(f"Enterprise Value:  {_fmt(target['enterprise_value'], ',.0f')}")
    print(f"Revenue:           {_fmt(target['revenue'], ',.0f')}")
    print(f"EBITDA:            {_fmt(target['ebitda'], ',.0f')}")
    print(f"Net Income:        {_fmt(target['net_income'], ',.0f')}")
    print(f"P/E:               {_fmt(target['pe_ratio'])}")
    print(f"EV/EBITDA:         {_fmt(target['ev_ebitda'])}")
    print(f"EV/Sales:          {_fmt(target['ev_sales'])}")
    print(f"P/Book:            {_fmt(target['p_book'])}")

    print(f"\n=== Peers Used: {', '.join(result['peers_used']) or 'none'} ===")
    stats = result["peer_statistics"]["statistics"]
    print(f"{'Metric':<12}{'Median':>10}{'Mean':>10}{'Min':>10}{'Max':>10}{'N':>5}")
    for metric in RATIO_METRICS:
        s = stats[metric]
        print(
            f"{metric:<12}"
            f"{_fmt(s['median']):>10}"
            f"{_fmt(s['mean']):>10}"
            f"{_fmt(s['min']):>10}"
            f"{_fmt(s['max']):>10}"
            f"{s['count']:>5}"
        )

    print(f"\n=== Implied Per-Share Values (current price: {_fmt(result['current_price'])}) ===")
    for method in ("pe_based", "ev_ebitda_based", "ev_sales_based"):
        v = result["implied_valuations"][method]
        if v is None:
            print(f"{method:<20} n/a")
        else:
            print(
                f"{method:<20} ${_fmt(v['implied_per_share'])}  "
                f"(multiple={_fmt(v['multiple_used'])})"
            )
