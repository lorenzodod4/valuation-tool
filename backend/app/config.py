"""Application configuration loaded from environment variables."""

import os

from dotenv import load_dotenv

load_dotenv()


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
    raise RuntimeError(
        "No FMP API key configured. Set at least FMP_API_KEY_1 in environment."
    )

# Alias so any legacy module importing the singular name still works.
FMP_API_KEY: str = FMP_API_KEYS[0]

FMP_BASE_URL: str = "https://financialmodelingprep.com/stable"

CACHE_TTL_SECONDS: int = 3600
CACHE_MAXSIZE: int = 500
HTTP_TIMEOUT_SECONDS: int = 30


# WACC inputs — sources cited, update every 3-6 months.
# Source: Aswath Damodaran, NYU Stern (https://pages.stern.nyu.edu/~adamodar/)
WACC_INPUTS: dict[str, float | str] = {
    "risk_free_rate": 0.0418,            # US 10Y Treasury yield, 2026-01-01
    "equity_risk_premium": 0.0423,       # Damodaran Implied ERP, January 2026 update
    "data_as_of": "2026-01-01",
    "rf_source": "US 10Y Treasury (Damodaran, Jan 2026)",
    "erp_source": "Damodaran Implied ERP (Jan 2026)",
    "default_cost_of_debt_pretax": 0.045,  # fallback when interest expense unavailable
}
