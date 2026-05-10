"""Financial Modeling Prep data fetcher (FMP /stable endpoints, sync httpx)."""

import time
from typing import Any

import httpx
from cachetools import TTLCache

from app.config import (
    CACHE_MAXSIZE,
    CACHE_TTL_SECONDS,
    FMP_API_KEY,
    FMP_BASE_URL,
    HTTP_TIMEOUT_SECONDS,
)


class FinancialDataFetcher:
    """Fetches and normalizes financial data from the FMP /stable API."""

    _client: httpx.Client | None = None
    _cache: TTLCache | None = None

    def __init__(self) -> None:
        if FinancialDataFetcher._client is None:
            FinancialDataFetcher._client = httpx.Client(
                base_url=FMP_BASE_URL,
                timeout=HTTP_TIMEOUT_SECONDS,
            )
        if FinancialDataFetcher._cache is None:
            FinancialDataFetcher._cache = TTLCache(
                maxsize=CACHE_MAXSIZE, ttl=CACHE_TTL_SECONDS
            )

    # ---------------- public API ----------------

    def get_profile(self, symbol: str) -> dict[str, Any] | None:
        """Fetch and normalize a company profile. Returns None if ticker not found."""
        sym = symbol.upper()
        data = self._request("/profile", {"symbol": sym}, f"profile:{sym}")
        if not data:
            return None
        raw = data[0] if isinstance(data, list) else data
        return self._normalize_profile(raw)

    def get_income_statement(
        self, symbol: str, limit: int = 5
    ) -> list[dict[str, Any]]:
        """Fetch and normalize annual income statements, most recent first."""
        sym = symbol.upper()
        data = self._request(
            "/income-statement",
            {"symbol": sym, "limit": limit},
            f"income:{sym}:{limit}",
        )
        if not isinstance(data, list):
            return []
        return [self._normalize_income(item) for item in data]

    def get_balance_sheet(
        self, symbol: str, limit: int = 5
    ) -> list[dict[str, Any]]:
        """Fetch and normalize annual balance sheets, most recent first."""
        sym = symbol.upper()
        data = self._request(
            "/balance-sheet-statement",
            {"symbol": sym, "limit": limit},
            f"balance:{sym}:{limit}",
        )
        if not isinstance(data, list):
            return []
        return [self._normalize_balance(item) for item in data]

    def get_cash_flow(
        self, symbol: str, limit: int = 5
    ) -> list[dict[str, Any]]:
        """Fetch and normalize annual cash flow statements, most recent first."""
        sym = symbol.upper()
        data = self._request(
            "/cash-flow-statement",
            {"symbol": sym, "limit": limit},
            f"cashflow:{sym}:{limit}",
        )
        if not isinstance(data, list):
            return []
        return [self._normalize_cashflow(item) for item in data]

    def get_key_metrics_ttm(self, symbol: str) -> dict[str, Any] | None:
        """Fetch trailing-twelve-month key metrics. Returns None if unavailable."""
        sym = symbol.upper()
        data = self._request(
            "/key-metrics-ttm",
            {"symbol": sym},
            f"keymetrics:{sym}",
        )
        if not data:
            return None
        raw = data[0] if isinstance(data, list) else data
        return self._normalize_key_metrics(raw)

    def get_ratios_ttm(self, symbol: str) -> dict[str, Any] | None:
        """Fetch TTM ratios (P/E, P/Book, PEG). Returns None if unavailable."""
        sym = symbol.upper()
        data = self._request(
            "/ratios-ttm",
            {"symbol": sym},
            f"ratios:{sym}",
        )
        if not data:
            return None
        raw = data[0] if isinstance(data, list) else data
        return self._normalize_ratios_ttm(raw)

    def get_stock_peers(self, symbol: str) -> list[dict[str, Any]]:
        """Fetch FMP's peer suggestions for a symbol.

        Returns the raw peer dicts ({symbol, companyName, price, mktCap}) so the
        caller can size-filter. Returns [] on empty response *or any error* —
        peer discovery should never sink the whole multiples valuation; the
        caller is expected to fall back to a static peer map.
        """
        sym = symbol.upper()
        try:
            data = self._request(
                "/stock-peers",
                {"symbol": sym},
                f"peers:{sym}",
            )
        except Exception:
            return []
        if not isinstance(data, list):
            return []
        return data

    def get_all_for_ticker(self, symbol: str) -> dict[str, Any] | None:
        """Fetch profile + 3 statements + TTM metrics + TTM ratios in one bundle.

        Returns None if the profile is missing (i.e. the ticker isn't recognized).
        Other endpoints failing return empty lists/None inside the bundle.
        """
        profile = self.get_profile(symbol)
        if profile is None:
            return None
        return {
            "profile": profile,
            "income_statement": self.get_income_statement(symbol),
            "balance_sheet": self.get_balance_sheet(symbol),
            "cash_flow": self.get_cash_flow(symbol),
            "key_metrics_ttm": self.get_key_metrics_ttm(symbol),
            "ratios_ttm": self.get_ratios_ttm(symbol),
        }

    # ---------------- HTTP plumbing ----------------

    def _request(
        self, path: str, params: dict[str, Any], cache_key: str
    ) -> Any:
        cache = FinancialDataFetcher._cache
        assert cache is not None
        if cache_key in cache:
            return cache[cache_key]

        client = FinancialDataFetcher._client
        assert client is not None

        full_params = {**params, "apikey": FMP_API_KEY}

        for attempt in range(2):
            try:
                response = client.get(path, params=full_params)
            except httpx.RequestError as exc:
                if attempt == 0:
                    time.sleep(1)
                    continue
                raise RuntimeError(
                    f"Network error contacting FMP: {exc}"
                ) from exc

            status = response.status_code
            if status in (401, 403):
                raise PermissionError("Invalid FMP API key")
            if status == 402:
                raise PermissionError(
                    "Ticker requires premium FMP subscription. "
                    "This tool supports US-listed equities on the free tier."
                )
            if status == 429:
                raise RuntimeError("FMP rate limit reached")
            if status >= 500:
                if attempt == 0:
                    time.sleep(1)
                    continue
                raise RuntimeError(f"FMP server error ({status})")
            if status >= 400:
                raise RuntimeError(
                    f"FMP request failed ({status}): {response.text[:200]}"
                )

            try:
                data = response.json()
            except ValueError as exc:
                raise RuntimeError(f"Invalid JSON from FMP: {exc}") from exc

            cache[cache_key] = data
            return data

        # Unreachable: both attempts should have either returned or raised.
        raise RuntimeError("FMP request failed after retry")

    # ---------------- normalization ----------------

    @staticmethod
    def _to_float(value: Any) -> float | None:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _to_int(value: Any) -> int | None:
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @classmethod
    def _normalize_profile(cls, raw: dict[str, Any]) -> dict[str, Any]:
        # FMP profile uses `marketCap` (not `mktCap`) and no longer returns `pe`
        # or `sharesOutstanding`. We derive shares from market_cap / price.
        market_cap = cls._to_float(raw.get("marketCap"))
        price = cls._to_float(raw.get("price"))
        shares_outstanding: float | None = None
        if market_cap and price and price > 0:
            shares_outstanding = market_cap / price

        return {
            "symbol": raw.get("symbol"),
            "name": raw.get("companyName"),
            "sector": raw.get("sector"),
            "industry": raw.get("industry"),
            "country": raw.get("country"),
            "currency": raw.get("currency"),
            "description": raw.get("description"),
            "beta": cls._to_float(raw.get("beta")),
            "market_cap": market_cap,
            "price": price,
            "shares_outstanding": shares_outstanding,
            "exchange": raw.get("exchange"),
            "exchange_full_name": raw.get("exchangeFullName"),
            "ipo_date": raw.get("ipoDate"),
            "isin": raw.get("isin"),
            "is_etf": raw.get("isEtf"),
        }

    @classmethod
    def _normalize_income(cls, raw: dict[str, Any]) -> dict[str, Any]:
        operating_income = cls._to_float(raw.get("operatingIncome"))
        return {
            "date": raw.get("date"),
            "year": cls._to_int(raw.get("calendarYear")),
            "revenue": cls._to_float(raw.get("revenue")),
            "ebitda": cls._to_float(raw.get("ebitda")),
            "operating_income": operating_income,
            # Alias so existing callers using "ebit" keep working.
            "ebit": operating_income,
            "net_income": cls._to_float(raw.get("netIncome")),
            "pretax_income": cls._to_float(raw.get("incomeBeforeTax")),
            "income_tax": cls._to_float(raw.get("incomeTaxExpense")),
            "da": cls._to_float(raw.get("depreciationAndAmortization")),
        }

    @classmethod
    def _normalize_balance(cls, raw: dict[str, Any]) -> dict[str, Any]:
        cash = cls._to_float(raw.get("cashAndCashEquivalents"))
        if cash is None:
            cash = cls._to_float(raw.get("cashAndShortTermInvestments"))
        return {
            "date": raw.get("date"),
            "year": cls._to_int(raw.get("calendarYear")),
            "total_debt": cls._to_float(raw.get("totalDebt")),
            "cash": cash,
            "stockholder_equity": cls._to_float(
                raw.get("totalStockholdersEquity")
            ),
            "total_assets": cls._to_float(raw.get("totalAssets")),
            "current_assets": cls._to_float(raw.get("totalCurrentAssets")),
            "current_liabilities": cls._to_float(
                raw.get("totalCurrentLiabilities")
            ),
            "common_stock_value": cls._to_float(raw.get("commonStock")),
        }

    @classmethod
    def _normalize_cashflow(cls, raw: dict[str, Any]) -> dict[str, Any]:
        # FMP reports CapEx as a negative outflow; the rest of the codebase wants the
        # positive magnitude, so absolute-value at the boundary.
        capex_raw = cls._to_float(raw.get("capitalExpenditure"))
        capex = abs(capex_raw) if capex_raw is not None else None
        return {
            "date": raw.get("date"),
            "year": cls._to_int(raw.get("calendarYear")),
            "capex": capex,
            "free_cash_flow": cls._to_float(raw.get("freeCashFlow")),
            "wc_change": cls._to_float(raw.get("changeInWorkingCapital")),
            "da": cls._to_float(raw.get("depreciationAndAmortization")),
        }

    @classmethod
    def _normalize_key_metrics(cls, raw: dict[str, Any]) -> dict[str, Any]:
        # FMP's key-metrics-ttm no longer carries pe / p_book; those moved to
        # ratios-ttm. EV/EBITDA was also renamed from
        # `enterpriseValueOverEBITDATTM` to `evToEBITDATTM`.
        return {
            "market_cap": cls._to_float(raw.get("marketCap")),
            "enterprise_value": cls._to_float(raw.get("enterpriseValueTTM")),
            "ev_sales": cls._to_float(raw.get("evToSalesTTM")),
            "ev_ebitda": cls._to_float(raw.get("evToEBITDATTM")),
            "roe": cls._to_float(raw.get("returnOnEquityTTM")),
            "roa": cls._to_float(raw.get("returnOnAssetsTTM")),
        }

    @classmethod
    def _normalize_ratios_ttm(cls, raw: dict[str, Any]) -> dict[str, Any]:
        return {
            "pe_ratio": cls._to_float(raw.get("priceToEarningsRatioTTM")),
            "p_book": cls._to_float(raw.get("priceToBookRatioTTM")),
            "peg_ratio": cls._to_float(raw.get("priceToEarningsGrowthRatioTTM")),
        }


if __name__ == "__main__":
    fetcher = FinancialDataFetcher()
    bundle = fetcher.get_all_for_ticker("AAPL")
    if bundle is None:
        print("Ticker not found")
    else:
        profile = bundle["profile"]
        print(f"Name:           {profile['name']}")
        print(f"Sector:         {profile['sector']}")
        print(f"Industry:       {profile['industry']}")
        print(f"Market Cap:     {profile['market_cap']}")
        print(f"Price:          {profile['price']}")
        print(f"Shares Out:     {profile['shares_outstanding']}")
        income = bundle["income_statement"]
        if income:
            latest = income[0]
            print(f"Latest year:    {latest.get('year')}")
            print(f"Latest revenue: {latest.get('revenue')}")
            print(f"Net income:    {latest.get('net_income')}")
        km = bundle.get("key_metrics_ttm") or {}
        print(f"TTM P/E:        {km.get('pe_ratio')}")
        print(f"TTM EV/EBITDA:  {km.get('ev_ebitda')}")
