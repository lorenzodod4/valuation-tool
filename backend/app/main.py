import collections
import logging
import os
import time

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
        return await call_next(request)


def create_app() -> FastAPI:
    """Application factory. Enables dependency injection and testability."""
    application = FastAPI(title="Valuation Tool API", version="0.1.0")

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
