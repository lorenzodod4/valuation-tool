"""Application configuration loaded from environment variables."""

import os

from dotenv import load_dotenv

load_dotenv()

FMP_API_KEY: str | None = os.getenv("FMP_API_KEY")
FMP_BASE_URL: str = "https://financialmodelingprep.com/api/v3"
