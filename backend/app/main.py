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
logger = logging.getLogger(__name__)
logger.info("Starting Valuation Tool API")


# Simple in-memory rate limiter: max N requests per IP in a sliding window.
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "20"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW", "60"))

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

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for non-valuation endpoints.
        if not request.url.path.startswith("/api/valuation"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        window_start = now - self._window_seconds

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

    # Allow Vercel preview deployments via regex (any *.vercel.app subdomain)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
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
