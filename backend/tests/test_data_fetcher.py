import pytest
import httpx
from app.services.data_fetcher import FinancialDataFetcher, PremiumTickerError, QuotaExhaustedError
from app.services.cache import PersistentCache


class TestFmp402Handling:
    """Phase 1.1 regression: 402 for premium tickers must not exhaust API keys."""

    def test_premium_ticker_402_does_not_exhaust_key(self):
        """A 402 with premium/subscription body should raise PremiumTickerError without marking the key exhausted."""

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                402,
                json={"message": "This ticker requires a premium subscription"},
            )

        transport = httpx.MockTransport(handler)
        client = httpx.Client(transport=transport, base_url="https://mock.fmp.com")
        # Set class-level singletons that _request reads directly
        FinancialDataFetcher._client = client
        if FinancialDataFetcher._cache is None:
            FinancialDataFetcher._cache = PersistentCache()

        with pytest.raises(PremiumTickerError) as exc_info:
            FinancialDataFetcher().get_profile("AAPL")

        assert "premium" in str(exc_info.value).lower() or "subscription" in str(exc_info.value).lower()
