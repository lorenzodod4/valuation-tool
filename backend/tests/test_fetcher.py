"""Fetcher behaviour: normalization, cache, coalescing, rotation, failures."""

import threading
import time

import httpx
import pytest

from app.services import data_fetcher
from app.services.data_fetcher import (
    FinancialDataFetcher,
    KeyRotator,
    PremiumTickerError,
    ProviderUnavailableError,
    QuotaExhaustedError,
)

F = FinancialDataFetcher


def _use_transport(handler) -> None:
    F._client = httpx.Client(
        transport=httpx.MockTransport(handler), base_url="https://mock.fmp"
    )


# ---------------- normalization ----------------


class TestNormalization:
    def test_stable_fiscal_year_is_read(self):
        row = F._normalize_income({"date": "2025-09-27", "fiscalYear": "2025", "revenue": 10})
        assert row["year"] == 2025

    def test_legacy_calendar_year_still_supported(self):
        row = F._normalize_income({"date": "2019-09-28", "calendarYear": "2019"})
        assert row["year"] == 2019

    def test_year_falls_back_to_statement_date(self):
        assert F._normalize_balance({"date": "2023-06-30"})["year"] == 2023

    def test_common_dividends_preferred_over_net_and_legacy(self):
        row = F._normalize_cashflow({
            "commonDividendsPaid": -100, "netDividendsPaid": -110, "dividendsPaid": -999,
        })
        assert row["dividends_paid"] == -100

    def test_legacy_dividends_field_fallback(self):
        assert F._normalize_cashflow({"dividendsPaid": -50})["dividends_paid"] == -50

    def test_capex_is_positive_magnitude(self):
        assert F._normalize_cashflow({"capitalExpenditure": -42})["capex"] == 42

    @pytest.mark.parametrize("bad", ["NaN", float("nan"), float("inf"), "abc", True, None, {}])
    def test_non_finite_and_garbage_numbers_become_none(self, bad):
        assert F._to_float(bad) is None

    def test_rows_sorted_most_recent_first(self):
        rows = F._normalize_rows(
            [{"date": "2021-12-31"}, {"date": "2025-12-31"}, {"date": "2023-12-31"}],
            F._normalize_income,
        )
        assert [r["date"][:4] for r in rows] == ["2025", "2023", "2021"]

    def test_non_list_payload_returns_empty(self):
        assert F._normalize_rows({"Error Message": "x"}, F._normalize_income) == []

    def test_profile_does_not_mislabel_peg_as_forward_pe(self):
        profile = F().get_profile("NWND")
        assert profile is not None
        assert profile["forward_pe"] is None
        assert profile["peg_ratio"] == pytest.approx(1.9)
        assert profile["shares_outstanding"] == pytest.approx(48_450_000_000 / 142.5)

    def test_unknown_ticker_profile_is_none(self):
        assert F().get_profile("NOPE") is None


# ---------------- cache + coalescing ----------------


class TestCacheAndCoalescing:
    def test_second_call_is_served_from_cache(self):
        fetcher = F()
        fetcher.get_all_for_ticker("NWND")
        first = F.upstream_calls
        fetcher.get_all_for_ticker("NWND")
        assert first == 6  # profile, ratios, 3 statements, key metrics
        assert F.upstream_calls == first

    def test_concurrent_callers_share_one_upstream_request(self):
        gate = threading.Event()

        def slow(request: httpx.Request) -> httpx.Response:
            gate.wait(2)
            return httpx.Response(200, json=[{"symbol": "SLOW", "price": 1, "marketCap": 1}])

        _use_transport(slow)
        results: list = []

        def worker():
            results.append(F().get_ratios_ttm("SLOW"))

        threads = [threading.Thread(target=worker) for _ in range(8)]
        for t in threads:
            t.start()
        time.sleep(0.2)
        gate.set()
        for t in threads:
            t.join(5)
        assert len(results) == 8
        assert F.upstream_calls == 1

    def test_statements_cached_longer_than_prices(self):
        cache = F._cache
        assert cache is not None
        fetcher = F()
        fetcher.get_income_statement("NWND")
        fetcher.get_profile("NWND")
        two_hours_ago = int(time.time()) - 7200
        cache._conn.execute("UPDATE fmp_cache SET created_at = ?", (two_hours_ago,))
        before = F.upstream_calls
        fetcher.get_income_statement("NWND")  # 24h TTL → still fresh
        assert F.upstream_calls == before
        fetcher.get_profile("NWND")  # 1h TTL → refetched (+ ratios)
        assert F.upstream_calls > before


# ---------------- failure handling ----------------


class TestFailures:
    def test_429_rotates_to_next_key(self, monkeypatch):
        rotator = KeyRotator(["key-a", "key-b"])
        monkeypatch.setattr(data_fetcher, "_rotator", rotator)
        seen: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            key = request.url.params["apikey"]
            seen.append(key)
            if key == "key-a":
                return httpx.Response(429, json={"message": "Limit Reach"})
            return httpx.Response(200, json=[{"priceToEarningsRatioTTM": 20}])

        _use_transport(handler)
        assert F().get_ratios_ttm("ABC") == {"pe_ratio": 20.0, "p_book": None, "peg_ratio": None}
        assert seen == ["key-a", "key-b"]

    def test_all_keys_exhausted_raises_quota_error(self, monkeypatch):
        monkeypatch.setattr(data_fetcher, "_rotator", KeyRotator(["a", "b"]))
        _use_transport(lambda r: httpx.Response(429, json={}))
        with pytest.raises(QuotaExhaustedError):
            F().get_ratios_ttm("ABC")
        assert F.upstream_calls == 2  # one per key, never a loop

    def test_premium_402_does_not_burn_key(self, monkeypatch):
        rotator = KeyRotator(["only"])
        monkeypatch.setattr(data_fetcher, "_rotator", rotator)
        _use_transport(lambda r: httpx.Response(
            402, json={"message": "This ticker requires a premium subscription"}))
        with pytest.raises(PremiumTickerError):
            F().get_profile("VOD.L")
        assert rotator.get_current_key() == "only"

    def test_server_error_retried_exactly_once(self):
        _use_transport(lambda r: httpx.Response(503, json={}))
        with pytest.raises(ProviderUnavailableError):
            F().get_ratios_ttm("ABC")
        assert F.upstream_calls == 2

    def test_network_error_message_never_contains_api_key(self, monkeypatch):
        monkeypatch.setattr(data_fetcher, "_rotator", KeyRotator(["SECRET-KEY-123"]))

        def boom(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError(f"failed {request.url}", request=request)

        _use_transport(boom)
        with pytest.raises(ProviderUnavailableError) as info:
            F().get_ratios_ttm("ABC")
        assert "SECRET-KEY-123" not in str(info.value)
        assert info.value.__cause__ is None

    def test_stale_cache_served_when_provider_down(self):
        cache = F._cache
        assert cache is not None
        cache.set("ratios:ABC", [{"priceToEarningsRatioTTM": 12}])
        cache._conn.execute(
            "UPDATE fmp_cache SET created_at = ? WHERE cache_key = 'ratios:ABC'",
            (int(time.time()) - 5 * 3600,),  # expired (1h TTL) but < 24h
        )
        _use_transport(lambda r: httpx.Response(503, json={}))
        assert F().get_ratios_ttm("ABC")["pe_ratio"] == 12.0

    def test_stale_profile_is_flagged(self):
        fetcher = F()
        fetcher.get_profile("NWND")
        cache = F._cache
        assert cache is not None
        cache._conn.execute("UPDATE fmp_cache SET created_at = ?", (int(time.time()) - 7200,))
        _use_transport(lambda r: httpx.Response(503, json={}))
        profile = fetcher.get_profile("NWND")
        assert profile is not None and profile["served_stale"] is True

    def test_too_old_cache_is_not_served(self):
        cache = F._cache
        assert cache is not None
        cache.set("ratios:ABC", [{"priceToEarningsRatioTTM": 12}])
        cache._conn.execute(
            "UPDATE fmp_cache SET created_at = ?", (int(time.time()) - 3 * 86400,)
        )
        _use_transport(lambda r: httpx.Response(503, json={}))
        with pytest.raises(ProviderUnavailableError):
            F().get_ratios_ttm("ABC")


def test_rotator_never_logs_key_material(caplog):
    caplog.set_level("DEBUG")
    rotator = KeyRotator(["abcdef-SECRET"])
    rotator.get_current_key()
    rotator.mark_exhausted("abcdef-SECRET")
    assert "SECRET" not in caplog.text
    assert "CRET" not in caplog.text
