"""Financial Modeling Prep data fetcher (FMP /stable endpoints, sync httpx).

Quota discipline is a design constraint here, not an optimisation: the free
FMP tier allows a few hundred calls per day across *all* users. Every request
therefore goes through, in order:

1. the SQLite cache (TTL depends on how quickly the payload can change),
2. single-flight coalescing (concurrent callers for the same key share one
   upstream call — the valuation page fires four endpoints in parallel that
   all need the same statements),
3. the network, with bounded retries and key rotation,
4. a stale-cache fallback when the provider is unavailable.
"""

import json
import logging
import threading
import time
from concurrent.futures import Future
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from app.config import (
    CACHE_TTL_SECONDS,
    FMP_API_KEYS,
    FMP_BASE_URL,
    FMP_FIXTURE_DIR,
    HTTP_TIMEOUT_SECONDS,
    STALE_PRICE_MAX_AGE_SECONDS,
    STALE_STATEMENT_MAX_AGE_SECONDS,
    STATEMENT_CACHE_TTL_SECONDS,
)
from app.services.cache import PersistentCache

logger = logging.getLogger(__name__)


class FmpProviderError(Exception):
    """Base for provider-side errors that are not local faults."""


class PremiumTickerError(FmpProviderError):
    """Raised when a ticker requires a premium FMP subscription."""


class QuotaExhaustedError(FmpProviderError):
    """Raised when all keys are over their daily call budget."""


class InvalidApiKeyError(FmpProviderError):
    """Raised when an FMP API key is invalid or revoked."""


class TickerNotFoundError(FmpProviderError):
    """Raised when a ticker is not found in FMP."""


class ProviderUnavailableError(FmpProviderError):
    """Raised on network failures, 5xx responses or malformed payloads."""


# Endpoints whose payloads only change when a new filing lands.
_SLOW_CHANGING_PREFIXES = ("income:", "balance:", "cashflow:", "peers:")


def _ttl_for(cache_key: str) -> int:
    if cache_key.startswith(_SLOW_CHANGING_PREFIXES):
        return STATEMENT_CACHE_TTL_SECONDS
    return CACHE_TTL_SECONDS


def _stale_window_for(cache_key: str) -> int:
    if cache_key.startswith(_SLOW_CHANGING_PREFIXES):
        return STALE_STATEMENT_MAX_AGE_SECONDS
    return STALE_PRICE_MAX_AGE_SECONDS


class KeyRotator:
    """Rotates across multiple FMP API keys when individual ones hit daily 429.

    Behavior:
    - `get_current_key()` returns the first key not in the exhausted set.
    - `mark_exhausted(key)` records a key as out-of-quota for the rest of the day.
    - The exhausted set is wiped automatically on UTC date rollover.

    Keys are only ever referred to by slot number in logs — never by value or
    suffix.
    """

    def __init__(self, keys: list[str]) -> None:
        if not keys:
            raise RuntimeError("KeyRotator requires at least one FMP API key.")
        self._keys: list[str] = list(keys)
        self._exhausted_today: set[str] = set()
        self._last_reset_date = datetime.now(timezone.utc).date()
        self._lock = threading.Lock()

    def _maybe_reset(self) -> None:
        today = datetime.now(timezone.utc).date()
        if today > self._last_reset_date:
            self._exhausted_today.clear()
            self._last_reset_date = today

    def get_current_key(self) -> str:
        with self._lock:
            self._maybe_reset()
            for idx, key in enumerate(self._keys, start=1):
                if key not in self._exhausted_today:
                    logger.debug("Using FMP key slot #%s", idx)
                    return key
            raise QuotaExhaustedError(
                "All FMP keys exhausted today. Resets at 00:00 UTC."
            )

    def mark_exhausted(self, key: str, reason: str = "429") -> None:
        with self._lock:
            try:
                idx: Any = self._keys.index(key) + 1
            except ValueError:
                idx = "?"
            logger.warning(
                "Marking FMP key slot #%s as exhausted (reason: %s)", idx, reason
            )
            self._exhausted_today.add(key)

    def reset(self) -> None:
        with self._lock:
            self._exhausted_today.clear()


# Module-level singleton — shared across every FinancialDataFetcher instance.
_rotator = KeyRotator(FMP_API_KEYS)


_FIXTURE_ENDPOINTS = {
    "/profile": "profile",
    "/income-statement": "income-statement",
    "/balance-sheet-statement": "balance-sheet-statement",
    "/cash-flow-statement": "cash-flow-statement",
    "/key-metrics-ttm": "key-metrics-ttm",
    "/ratios-ttm": "ratios-ttm",
    "/stock-peers": "stock-peers",
}


def fixture_transport(fixture_dir: str | Path) -> httpx.MockTransport:
    """Serve FMP-shaped responses from `<dir>/<endpoint>/<SYMBOL>.json`.

    A missing fixture answers `200 []`, which is what FMP returns for an
    unknown symbol. A fixture file may also be `{"__status__": 429}` etc. to
    simulate provider failures deterministically.
    """
    root = Path(fixture_dir)

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        endpoint = next(
            (name for suffix, name in _FIXTURE_ENDPOINTS.items() if path.endswith(suffix)),
            None,
        )
        symbol = (request.url.params.get("symbol") or "").upper()
        if endpoint is None or not symbol:
            return httpx.Response(404, json={"message": "Unknown fixture endpoint"})
        file = root / endpoint / f"{symbol}.json"
        if not file.is_file():
            return httpx.Response(200, json=[])
        payload = json.loads(file.read_text())
        if isinstance(payload, dict) and "__status__" in payload:
            return httpx.Response(
                int(payload["__status__"]), json=payload.get("body", {})
            )
        return httpx.Response(200, json=payload)

    return httpx.MockTransport(handler)


class FinancialDataFetcher:
    """Fetches and normalizes financial data from the FMP /stable API."""

    _client: httpx.Client | None = None
    _cache: PersistentCache | None = None
    _inflight: dict[str, Future] = {}
    _inflight_lock = threading.Lock()
    # Count of HTTP requests actually sent upstream since process start.
    upstream_calls: int = 0
    _counter_lock = threading.Lock()
    # Retry backoff in seconds; patched to 0 in tests.
    retry_backoff_seconds: float = 1.0

    def __init__(self) -> None:
        if FinancialDataFetcher._client is None:
            if FMP_FIXTURE_DIR:
                logger.warning(
                    "FMP fixture mode active (%s): no network requests will be made.",
                    FMP_FIXTURE_DIR,
                )
                FinancialDataFetcher._client = httpx.Client(
                    base_url=FMP_BASE_URL,
                    transport=fixture_transport(FMP_FIXTURE_DIR),
                )
            else:
                FinancialDataFetcher._client = httpx.Client(
                    base_url=FMP_BASE_URL,
                    timeout=HTTP_TIMEOUT_SECONDS,
                )
        if FinancialDataFetcher._cache is None:
            FinancialDataFetcher._cache = PersistentCache()

    # ---------------- public API ----------------

    def get_profile(self, symbol: str) -> dict[str, Any] | None:
        """Fetch and normalize a company profile. Returns None if ticker not found.

        The FMP /stable/profile endpoint no longer includes `pe_ratio` or
        `peg_ratio`, so we enrich the result with TTM ratios. The enrichment
        is best-effort: if /ratios-ttm fails, the profile still returns
        successfully with these fields left at None.
        """
        sym = symbol.upper()
        data, meta = self._request_with_meta("/profile", {"symbol": sym}, f"profile:{sym}")
        if not data:
            return None
        raw = data[0] if isinstance(data, list) else data
        if not isinstance(raw, dict):
            return None
        profile = self._normalize_profile(raw)
        profile["data_as_of"] = meta.get("fetched_at")
        profile["served_stale"] = bool(meta.get("stale"))

        try:
            ratios = self.get_ratios_ttm(sym)
        except Exception:
            ratios = None
        if ratios:
            profile["pe_ratio"] = ratios.get("pe_ratio")
            profile["peg_ratio"] = ratios.get("peg_ratio")

        return profile

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
        return self._normalize_rows(data, self._normalize_income)

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
        return self._normalize_rows(data, self._normalize_balance)

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
        return self._normalize_rows(data, self._normalize_cashflow)

    def get_key_metrics_ttm(self, symbol: str) -> dict[str, Any] | None:
        """Fetch trailing-twelve-month key metrics. Returns None if unavailable."""
        sym = symbol.upper()
        data = self._request(
            "/key-metrics-ttm",
            {"symbol": sym},
            f"metrics:{sym}",
        )
        raw = self._first_record(data)
        return self._normalize_key_metrics(raw) if raw is not None else None

    def get_ratios_ttm(self, symbol: str) -> dict[str, Any] | None:
        """Fetch TTM ratios (P/E, P/Book, PEG). Returns None if unavailable."""
        sym = symbol.upper()
        data = self._request(
            "/ratios-ttm",
            {"symbol": sym},
            f"ratios:{sym}",
        )
        raw = self._first_record(data)
        return self._normalize_ratios_ttm(raw) if raw is not None else None

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
        return [p for p in data if isinstance(p, dict)]

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

    def get_market_snapshot(self, symbol: str) -> dict[str, Any] | None:
        """Profile + TTM ratios + TTM key metrics — no statements (3 calls).

        Enough to compute a peer's P/E, EV/EBITDA, EV/Sales and P/Book whenever
        FMP's TTM fields are populated, which is the common case.
        """
        profile = self.get_profile(symbol)
        if profile is None:
            return None
        return {
            "profile": profile,
            "key_metrics_ttm": self.get_key_metrics_ttm(symbol),
            "ratios_ttm": self.get_ratios_ttm(symbol),
        }

    # ---------------- HTTP plumbing ----------------

    def _request(self, path: str, params: dict[str, Any], cache_key: str) -> Any:
        data, _meta = self._request_with_meta(path, params, cache_key)
        return data

    def _request_with_meta(
        self, path: str, params: dict[str, Any], cache_key: str
    ) -> tuple[Any, dict[str, Any]]:
        """Return (payload, meta) where meta has `fetched_at` and `stale`."""
        cache = FinancialDataFetcher._cache
        assert cache is not None
        cached, created_at = cache.get_with_age(cache_key)
        now = int(time.time())
        if cached is not None and created_at is not None and created_at > now - _ttl_for(cache_key):
            return cached, {"fetched_at": created_at, "stale": False}

        # Single-flight: the first caller for a key does the network work; any
        # concurrent caller waits on the same Future instead of spending quota.
        with FinancialDataFetcher._inflight_lock:
            future = FinancialDataFetcher._inflight.get(cache_key)
            owner = future is None
            if owner:
                future = Future()
                FinancialDataFetcher._inflight[cache_key] = future

        assert future is not None
        if not owner:
            return future.result(timeout=HTTP_TIMEOUT_SECONDS * 4)

        try:
            data = self._fetch_upstream(path, params)
            cache.set(cache_key, data)
            result: tuple[Any, dict[str, Any]] = (data, {"fetched_at": int(time.time()), "stale": False})
        except (QuotaExhaustedError, ProviderUnavailableError) as exc:
            stale_ok = (
                cached is not None
                and created_at is not None
                and created_at > now - _stale_window_for(cache_key)
            )
            if not stale_ok:
                future.set_exception(exc)
                raise
            logger.warning(
                "Provider unavailable for %s (%s); serving cached copy from %s",
                cache_key,
                type(exc).__name__,
                datetime.fromtimestamp(created_at, timezone.utc).isoformat(),
            )
            result = (cached, {"fetched_at": created_at, "stale": True})
        except BaseException as exc:
            future.set_exception(exc)
            raise
        finally:
            with FinancialDataFetcher._inflight_lock:
                FinancialDataFetcher._inflight.pop(cache_key, None)

        future.set_result(result)
        return result

    def _fetch_upstream(self, path: str, params: dict[str, Any]) -> Any:
        client = FinancialDataFetcher._client
        assert client is not None

        # Track per-key quota-style failures so the final error can distinguish
        # "every key is premium-locked for this ticker" (all 402) from "every
        # key is over its daily call budget" (any 429 in the mix).
        attempts: list[int] = []

        # Outer loop: rotate through API keys when one returns 402 or 429.
        # Bounded by the number of keys because each pass burns one key.
        while True:
            try:
                current_key = _rotator.get_current_key()
            except QuotaExhaustedError:
                if attempts and all(status == 402 for status in attempts):
                    raise PremiumTickerError(
                        "Ticker requires premium FMP subscription on all "
                        "available keys. This may be a non-US listed equity."
                    )
                raise

            full_params = {**params, "apikey": current_key}

            # Inner loop: one network/5xx retry on the same key.
            rotated_for_quota = False
            for attempt in range(2):
                try:
                    with FinancialDataFetcher._counter_lock:
                        FinancialDataFetcher.upstream_calls += 1
                    response = client.get(path, params=full_params)
                except httpx.RequestError as exc:
                    if attempt == 0:
                        time.sleep(self.retry_backoff_seconds)
                        continue
                    # Deliberately not echoing `exc`: httpx messages can embed
                    # the request URL, which carries the API key.
                    raise ProviderUnavailableError(
                        f"Network error contacting FMP ({type(exc).__name__})"
                    ) from None

                status = response.status_code
                if status in (401, 403):
                    raise InvalidApiKeyError("Invalid FMP API key")
                if status == 429:
                    # Genuine rate-limit: burn this key and rotate.
                    _rotator.mark_exhausted(current_key, reason="429")
                    attempts.append(status)
                    rotated_for_quota = True
                    break
                if status == 402:
                    # 402 may mean:
                    #  a) premium ticker (ticker-specific, do NOT burn key)
                    #  b) key plan restriction (global, burn key)
                    # Inspect body to decide.
                    lower_body = ""
                    try:
                        lower_body = response.text[:500].lower()
                    except Exception:
                        pass
                    if any(
                        token in lower_body
                        for token in ("premium", "subscription", "ticker", "not available")
                    ):
                        raise PremiumTickerError(
                            "Ticker requires premium FMP subscription. "
                            "This may be a non-US listed equity or a ticker "
                            "outside the free tier."
                        )
                    _rotator.mark_exhausted(current_key, reason="402")
                    attempts.append(status)
                    rotated_for_quota = True
                    break
                if status >= 500:
                    if attempt == 0:
                        time.sleep(self.retry_backoff_seconds)
                        continue
                    raise ProviderUnavailableError(f"FMP server error ({status})")
                if status == 404:
                    raise TickerNotFoundError("Ticker not found in FMP")
                if status >= 400:
                    raise ProviderUnavailableError(f"FMP request failed ({status})")

                try:
                    return response.json()
                except ValueError:
                    raise ProviderUnavailableError("Invalid JSON from FMP") from None

            if rotated_for_quota:
                continue

            raise ProviderUnavailableError("FMP request failed after retry")

    # ---------------- normalization ----------------

    @staticmethod
    def _first_record(data: Any) -> dict[str, Any] | None:
        raw = data[0] if isinstance(data, list) and data else data
        return raw if isinstance(raw, dict) and raw else None

    @staticmethod
    def _normalize_rows(data: Any, normalizer: Any) -> list[dict[str, Any]]:
        if not isinstance(data, list):
            return []
        rows = [normalizer(item) for item in data if isinstance(item, dict)]
        # FMP returns most-recent-first; enforce it so every downstream
        # "latest = rows[0]" assumption holds even if the order ever changes.
        if all(r.get("date") for r in rows):
            rows.sort(key=lambda r: str(r["date"]), reverse=True)
        return rows

    @staticmethod
    def _to_float(value: Any) -> float | None:
        if value is None or isinstance(value, bool):
            return None
        try:
            result = float(value)
        except (TypeError, ValueError):
            return None
        # NaN/inf from a malformed payload must never reach the models.
        if result != result or result in (float("inf"), float("-inf")):
            return None
        return result

    @staticmethod
    def _to_int(value: Any) -> int | None:
        if value is None or isinstance(value, bool):
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @classmethod
    def _fiscal_year(cls, raw: dict[str, Any]) -> int | None:
        """FMP /stable reports `fiscalYear`; the legacy v3 API used
        `calendarYear`. Fall back to the statement date's year."""
        for key in ("fiscalYear", "calendarYear"):
            year = cls._to_int(raw.get(key))
            if year is not None:
                return year
        date = raw.get("date")
        if isinstance(date, str) and len(date) >= 4:
            return cls._to_int(date[:4])
        return None

    @classmethod
    def _first_float(cls, raw: dict[str, Any], *keys: str) -> float | None:
        for key in keys:
            value = cls._to_float(raw.get(key))
            if value is not None:
                return value
        return None

    @classmethod
    def _normalize_profile(cls, raw: dict[str, Any]) -> dict[str, Any]:
        # FMP profile uses `marketCap` (not `mktCap`) and no longer returns
        # `pe` or `sharesOutstanding`. We derive shares from market_cap / price.
        market_cap = cls._first_float(raw, "marketCap", "mktCap")
        price = cls._to_float(raw.get("price"))
        shares_outstanding: float | None = None
        if market_cap and market_cap > 0 and price and price > 0:
            shares_outstanding = market_cap / price

        return {
            "symbol": raw.get("symbol"),
            "name": raw.get("companyName"),
            "sector": raw.get("sector") or None,
            "industry": raw.get("industry") or None,
            "country": raw.get("country") or None,
            "currency": raw.get("currency") or None,
            "description": raw.get("description") or None,
            "beta": cls._to_float(raw.get("beta")),
            "market_cap": market_cap,
            "price": price,
            "shares_outstanding": shares_outstanding,
            # P/E TTM and PEG are not in the /stable/profile payload; they are
            # populated in `get_profile` from /ratios-ttm. Forward P/E is not
            # available on the free tier and is reported as None rather than
            # substituted with another ratio.
            "pe_ratio": None,
            "peg_ratio": None,
            "forward_pe": None,
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
            "year": cls._fiscal_year(raw),
            "currency": raw.get("reportedCurrency"),
            "revenue": cls._to_float(raw.get("revenue")),
            "ebitda": cls._to_float(raw.get("ebitda")),
            "operating_income": operating_income,
            # Alias so callers using "ebit" keep working.
            "ebit": operating_income,
            "net_income": cls._to_float(raw.get("netIncome")),
            "pretax_income": cls._to_float(raw.get("incomeBeforeTax")),
            "income_tax": cls._to_float(raw.get("incomeTaxExpense")),
            "interest_expense": cls._to_float(raw.get("interestExpense")),
            "da": cls._to_float(raw.get("depreciationAndAmortization")),
        }

    @classmethod
    def _normalize_balance(cls, raw: dict[str, Any]) -> dict[str, Any]:
        cash = cls._first_float(raw, "cashAndCashEquivalents", "cashAndShortTermInvestments")
        return {
            "date": raw.get("date"),
            "year": cls._fiscal_year(raw),
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
            "shares_outstanding": cls._to_float(
                raw.get("commonStockSharesOutstanding")
            ),
        }

    @classmethod
    def _normalize_cashflow(cls, raw: dict[str, Any]) -> dict[str, Any]:
        # FMP reports CapEx as a negative outflow; the rest of the codebase
        # wants the positive magnitude, so absolute-value at the boundary.
        capex_raw = cls._to_float(raw.get("capitalExpenditure"))
        capex = abs(capex_raw) if capex_raw is not None else None

        # Dividends to common shareholders (negative outflow, stored as-is).
        # /stable splits the legacy `dividendsPaid` into common / preferred /
        # net. Common is the right basis for a per-share DDM; net and the
        # legacy field are fallbacks.
        dividends_paid = cls._first_float(
            raw, "commonDividendsPaid", "netDividendsPaid", "dividendsPaid"
        )

        return {
            "date": raw.get("date"),
            "year": cls._fiscal_year(raw),
            "capex": capex,
            "free_cash_flow": cls._to_float(raw.get("freeCashFlow")),
            "wc_change": cls._to_float(raw.get("changeInWorkingCapital")),
            "da": cls._to_float(raw.get("depreciationAndAmortization")),
            "dividends_paid": dividends_paid,
        }

    @classmethod
    def _normalize_key_metrics(cls, raw: dict[str, Any]) -> dict[str, Any]:
        return {
            "market_cap": cls._first_float(raw, "marketCap", "marketCapTTM"),
            "enterprise_value": cls._to_float(raw.get("enterpriseValueTTM")),
            "ev_sales": cls._to_float(raw.get("evToSalesTTM")),
            "ev_ebitda": cls._first_float(raw, "evToEBITDATTM", "enterpriseValueOverEBITDATTM"),
            "roe": cls._to_float(raw.get("returnOnEquityTTM")),
            "roa": cls._to_float(raw.get("returnOnAssetsTTM")),
        }

    @classmethod
    def _normalize_ratios_ttm(cls, raw: dict[str, Any]) -> dict[str, Any]:
        return {
            "pe_ratio": cls._to_float(raw.get("priceToEarningsRatioTTM")),
            "p_book": cls._to_float(raw.get("priceToBookRatioTTM")),
            "peg_ratio": cls._to_float(
                raw.get("priceToEarningsGrowthRatioTTM")
            ),
        }
