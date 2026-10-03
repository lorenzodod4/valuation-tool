"""Test configuration: every test runs offline against deterministic fixtures.

The environment is set before `app` is imported so the fetcher is built with
the fixture transport and an in-memory cache. No test can reach the network.
"""

import os
from pathlib import Path

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "fmp"
os.environ["FMP_FIXTURE_DIR"] = str(FIXTURE_DIR)
os.environ["FMP_CACHE_PATH"] = ":memory:"
os.environ.setdefault("FMP_API_KEY_1", "test-key-one")
os.environ["RATE_LIMIT_REQUESTS"] = "100000"
os.environ["COLD_TICKERS_PER_HOUR"] = "0"  # dedicated tests opt in explicitly

import pytest  # noqa: E402

from app.services import data_fetcher  # noqa: E402
from app.services.data_fetcher import FinancialDataFetcher  # noqa: E402


@pytest.fixture(autouse=True)
def _isolated_fetcher(monkeypatch):
    """Fresh cache, fresh key state, zero backoff, fixture client restored."""
    FinancialDataFetcher()  # ensure singletons exist
    original_client = FinancialDataFetcher._client
    assert FinancialDataFetcher._cache is not None
    FinancialDataFetcher._cache.clear()
    data_fetcher._rotator.reset()
    FinancialDataFetcher.upstream_calls = 0
    monkeypatch.setattr(FinancialDataFetcher, "retry_backoff_seconds", 0.0)
    yield
    FinancialDataFetcher._client = original_client
    FinancialDataFetcher._inflight.clear()
    data_fetcher._rotator.reset()
