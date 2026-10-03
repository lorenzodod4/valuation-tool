import collections
import json
import logging
import math
import os
import re
import time
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.api import valuation

# Logging configuration — INFO by default, DEBUG when LOG_LEVEL=debug is set.
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
# httpx logs full request URLs at INFO, and FMP authenticates via an `apikey`
# query parameter — never let those lines reach the logs.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)
logger.info("Starting Valuation Tool API")


# Simple in-memory rate limiter: max N requests per IP in a sliding window.
# One report page issues four requests; cached responses cost no provider
# quota, so the limit guards against abuse rather than metering normal use.
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "60"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW", "60"))

# Number of reverse proxies in front of the app that append to X-Forwarded-For
# (e.g. 1 on Render). 0 = use the socket peer address. Only the entries added by
# trusted proxies are read, so a client cannot spoof its way past the limiter.
TRUSTED_PROXY_HOPS = int(os.getenv("TRUSTED_PROXY_HOPS", "0"))


def _client_ip(request: Request) -> str:
    if TRUSTED_PROXY_HOPS > 0:
        forwarded = request.headers.get("x-forwarded-for", "")
        hops = [h.strip() for h in forwarded.split(",") if h.strip()]
        if len(hops) >= TRUSTED_PROXY_HOPS:
            return hops[-TRUSTED_PROXY_HOPS]
    return request.client.host if request.client else "unknown"


# Uncached ("cold") tickers are what spend provider quota (~25 calls each), so
# they get their own, much smaller per-IP budget. Cached tickers are free.
COLD_TICKERS_PER_HOUR = int(os.getenv("COLD_TICKERS_PER_HOUR", "12"))
_TICKER_PATH = re.compile(r"^/api/valuation/([A-Za-z0-9][A-Za-z0-9.-]{0,9})/")


def _is_cold(ticker: str) -> bool:
    from app.config import CACHE_TTL_SECONDS
    from app.services.data_fetcher import FinancialDataFetcher

    cache = FinancialDataFetcher._cache
    if cache is None:
        return True
    return cache.get(f"profile:{ticker.upper()}", ttl_seconds=CACHE_TTL_SECONDS) is None


class ColdTickerBudget:
    """Per-IP sliding-hour budget of distinct uncached tickers."""

    def __init__(self, per_hour: int) -> None:
        self._per_hour = per_hour
        self._seen: dict[str, dict[str, float]] = {}

    def allow(self, ip: str, ticker: str, now: float) -> tuple[bool, int]:
        recent = {t: ts for t, ts in self._seen.get(ip, {}).items() if ts > now - 3600}
        if ticker in recent:
            # Same ticker within the hour (e.g. the page's parallel requests).
            self._seen[ip] = recent
            return True, 0
        if len(recent) >= self._per_hour:
            self._seen[ip] = recent
            oldest = min(recent.values())
            return False, int(oldest + 3600 - now) + 1
        recent[ticker] = now
        self._seen[ip] = recent
        return True, 0

    def prune(self, now: float) -> None:
        for ip in [ip for ip, seen in self._seen.items() if all(ts <= now - 3600 for ts in seen.values())]:
            del self._seen[ip]


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding-window rate limiter keyed by client IP.

    Tracks request timestamps per IP in a deque. If the count exceeds the
    threshold within the window, returns a 429 response with a Retry-After
    header. Bypasses health check and root endpoints to avoid false
    positives during load-balancer pings.
    """

    def __init__(self, app, requests_per_window: int, window_seconds: int) -> None:
        super().__init__(app)
        self._requests_per_window = requests_per_window
        self._window_seconds = window_seconds
        self._history: dict[str, collections.deque[float]] = {}
        self._calls_since_prune = 0
        self._cold = ColdTickerBudget(COLD_TICKERS_PER_HOUR)

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for non-valuation endpoints.
        if not request.url.path.startswith("/api/valuation"):
            return await call_next(request)

        client_ip = _client_ip(request)
        now = time.monotonic()
        window_start = now - self._window_seconds

        # Bound memory: periodically drop IPs with no requests in the window.
        self._calls_since_prune += 1
        if self._calls_since_prune >= 500:
            self._calls_since_prune = 0
            for ip in [ip for ip, d in self._history.items() if not d or d[-1] < window_start]:
                del self._history[ip]
            self._cold.prune(time.time())

        # Get or create the deque for this IP, dropping expired entries.
        deq = self._history.get(client_ip)
        if deq is None:
            deq = collections.deque()
            self._history[client_ip] = deq

        # Purge entries older than the window.
        while deq and deq[0] < window_start:
            deq.popleft()

        if len(deq) >= self._requests_per_window:
            # Find when the oldest entry in the window expires for a precise
            # Retry-After.
            oldest = deq[0] if deq else now
            retry_after = int(oldest + self._window_seconds - now) + 1
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again shortly."},
                headers={"Retry-After": str(max(retry_after, 1))},
            )

        deq.append(now)

        match = _TICKER_PATH.match(request.url.path)
        if match and COLD_TICKERS_PER_HOUR > 0:
            # The target plus any custom peers: each uncached one spends quota.
            candidates = [match.group(1).upper()] + [
                p.strip().upper()
                for p in re.split(r"[,\s]+", request.query_params.get("peers", ""))[:8]
                if p.strip()
            ]
            for ticker in dict.fromkeys(candidates):
                if not _is_cold(ticker):
                    continue
                allowed, retry_after = self._cold.allow(client_ip, ticker, time.time())
                if not allowed:
                    return JSONResponse(
                        status_code=429,
                        content={
                            "detail": (
                                "You have analysed many new tickers in the last hour. "
                                "Previously analysed tickers remain available; new ones "
                                "will be possible again shortly."
                            )
                        },
                        headers={"Retry-After": str(max(retry_after, 1))},
                    )
        return await call_next(request)


def _finite(value: Any) -> Any:
    """Replace NaN/±Infinity with None anywhere in a response payload."""
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {k: _finite(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_finite(v) for v in value]
    return value


class FiniteJSONResponse(JSONResponse):
    """JSON responses never carry NaN/Infinity: a degenerate model output
    becomes null (rendered as "—") instead of a 500 for the whole report."""

    def render(self, content: Any) -> bytes:
        try:
            return json.dumps(content, allow_nan=False, separators=(",", ":")).encode("utf-8")
        except ValueError:
            logger.warning("Non-finite number in response payload replaced with null")
            return json.dumps(_finite(content), allow_nan=False, separators=(",", ":")).encode("utf-8")


def create_app() -> FastAPI:
    """Application factory. Enables dependency injection and testability."""
    application = FastAPI(
        title="Valuation Tool API",
        version="0.2.0",
        default_response_class=FiniteJSONResponse,
    )

    # Rate limiter must be registered before other middleware so it runs first.
    application.add_middleware(
        RateLimitMiddleware,
        requests_per_window=RATE_LIMIT_REQUESTS,
        window_seconds=RATE_LIMIT_WINDOW_SECONDS,
    )

    # CORS configuration
    # In production, set ALLOWED_ORIGINS env var to a comma-separated list of allowed domains
    # Example: ALLOWED_ORIGINS=https://valuation-tool.vercel.app,https://www.valuation-tool.com
    default_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    env_origins = os.getenv("ALLOWED_ORIGINS", "")
    if env_origins:
        extra_origins = [o.strip() for o in env_origins.split(",") if o.strip()]
        allowed_origins = default_origins + extra_origins
    else:
        allowed_origins = default_origins

    # Production + preview deployments of this project only. The API uses no
    # cookies or auth headers, so credentials are not allowed.
    origin_regex = os.getenv(
        "ALLOWED_ORIGIN_REGEX", r"https://valuation-tool[a-z0-9-]*\.vercel\.app"
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=origin_regex,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
        expose_headers=["Retry-After"],
    )

    application.include_router(valuation.router)

    @application.get("/")
    def root() -> dict[str, str]:
        return {"status": "ok", "service": "valuation-tool-api"}

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "healthy"}

    return application


app = create_app()
