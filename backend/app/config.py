"""Application configuration loaded from environment variables."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parent.parent

# Offline mode: when set, every FMP request is answered from JSON fixtures on
# disk instead of the network. Used for local development, demos and tests so
# the limited FMP quota is never spent on the development loop.
FMP_FIXTURE_DIR: str | None = os.getenv("FMP_FIXTURE_DIR") or None


def _collect_keys() -> list[str]:
    """Read FMP keys in priority order. Empty/missing slots are skipped.

    Priority:
      FMP_API_KEY_1 → FMP_API_KEY_2 → FMP_API_KEY_3 → FMP_API_KEY_4
    `FMP_API_KEY` (no suffix) is honored as a fallback for slot #1 so older
    deployments keep working.
    """
    primary = os.getenv("FMP_API_KEY_1") or os.getenv("FMP_API_KEY") or ""
    secondary = os.getenv("FMP_API_KEY_2") or ""
    tertiary = os.getenv("FMP_API_KEY_3") or ""
    quaternary = os.getenv("FMP_API_KEY_4") or ""
    return [k for k in (primary, secondary, tertiary, quaternary) if k]


FMP_API_KEYS: list[str] = _collect_keys()
if not FMP_API_KEYS:
    if FMP_FIXTURE_DIR:
        # Fixture transport never sends the key anywhere; a placeholder keeps
        # the rotator logic identical to production.
        FMP_API_KEYS = ["fixture-mode"]
    else:
        raise RuntimeError(
            "No FMP API key configured. Set at least FMP_API_KEY_1 in environment."
        )

# Alias so any legacy module importing the singular name still works.
FMP_API_KEY: str = FMP_API_KEYS[0]

FMP_BASE_URL: str = "https://financialmodelingprep.com/stable"

# Price-sensitive payloads (profile, TTM ratios, TTM key metrics) refresh hourly.
CACHE_TTL_SECONDS: int = 3600
# Annual statements and peer lists change at most quarterly; caching them for a
# day cuts repeat-ticker quota usage by roughly two thirds.
STATEMENT_CACHE_TTL_SECONDS: int = int(os.getenv("STATEMENT_CACHE_TTL", "86400"))
# When the provider is unavailable (quota, network, 5xx) an expired cache row
# younger than this is served instead of failing the request.
STALE_PRICE_MAX_AGE_SECONDS: int = 24 * 3600
STALE_STATEMENT_MAX_AGE_SECONDS: int = 7 * 24 * 3600

CACHE_MAXSIZE: int = 500
HTTP_TIMEOUT_SECONDS: int = 30
CACHE_DB_PATH: str = os.getenv(
    "FMP_CACHE_PATH",
    ":memory:" if FMP_FIXTURE_DIR else str(BACKEND_DIR / "cache.db"),
)


# WACC inputs — sources cited, update every 3-6 months.
# Risk-free rate: US 10-year Treasury constant-maturity yield (FRED DGS10).
#   5.29% on 2026-09-30; ~5.28% close on 2026-10-02.
# ERP: Aswath Damodaran, NYU Stern (https://pages.stern.nyu.edu/~adamodar/),
#   implied ERP, trailing-12-month cash yield. Kept at the January 2026 value
#   until a newer published figure is verified at the source.
# `data_as_of` is the date of the OLDEST input, so the staleness flag stays honest.
WACC_INPUTS: dict[str, float | str] = {
    "risk_free_rate": 0.0528,            # US 10Y Treasury yield, 2026-10-02
    "equity_risk_premium": 0.0423,       # Damodaran Implied ERP, January 2026 update
    "data_as_of": "2026-01-01",
    "rf_as_of": "2026-10-02",
    "erp_as_of": "2026-01-01",
    "rf_source": "US 10Y Treasury yield (2 Oct 2026)",
    "erp_source": "Damodaran implied ERP (Jan 2026)",
    "default_cost_of_debt_pretax": 0.045,  # fallback when interest expense unavailable
}
