"""Application configuration loaded from environment variables."""

import os

from dotenv import load_dotenv

load_dotenv()

FMP_API_KEY: str | None = os.getenv("FMP_API_KEY")
if not FMP_API_KEY:
    raise RuntimeError(
        "FMP_API_KEY is not set. Add it to backend/.env (see .env.example)."
    )

FMP_BASE_URL: str = "https://financialmodelingprep.com/stable"

CACHE_TTL_SECONDS: int = 3600
CACHE_MAXSIZE: int = 500
HTTP_TIMEOUT_SECONDS: int = 30
