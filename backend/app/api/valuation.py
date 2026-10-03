"""FastAPI router for the valuation endpoints."""

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Callable, TypeVar

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import (
    CompanyProfile,
    DCFAssumptions,
    DCFResult,
    FinancialStatement,
    FullValuation,
    MultiplesResult,
    ReverseDCFResult,
)
from app.services.data_fetcher import (
    FinancialDataFetcher,
    FmpProviderError,
    InvalidApiKeyError,
    PremiumTickerError,
    ProviderUnavailableError,
    QuotaExhaustedError,
    TickerNotFoundError,
)
from app.services.dcf import DCFValuator
from app.services.ddm import DDMValuator
from app.services.multiples import MultiplesValuator
from app.services.wacc import compute_wacc, is_data_stale

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/valuation", tags=["valuation"])

_fetcher = FinancialDataFetcher()
_dcf = DCFValuator()
_ddm = DDMValuator()
_multiples = MultiplesValuator(_fetcher)

SYMBOL_PATTERN = re.compile(r"^[A-Z0-9][A-Z0-9.-]{0,9}$")
MAX_CUSTOM_PEERS = 8

# Sensitivity grid: steps around the company's own base case, so the centre
# cell always equals the headline DCF value.
SENSITIVITY_WACC_STEPS = (-0.02, -0.01, 0.0, 0.01, 0.02)
SENSITIVITY_TG_STEPS = (-0.01, -0.005, 0.0, 0.005, 0.01)

T = TypeVar("T")


def _normalize_symbol(symbol: str) -> str:
    normalized = symbol.strip().upper()
    if not SYMBOL_PATTERN.fullmatch(normalized):
        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid ticker format. Use 1-10 characters: letters, numbers, "
                "dot, or hyphen."
            ),
        )
    return normalized


def _seconds_until_utc_midnight() -> int:
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(60, int((tomorrow - now).total_seconds()))


def _upstream_http_error(exc: Exception, ticker: str) -> HTTPException:
    """Translate fetcher exceptions into HTTP responses.

    Messages are written for end users and never echo raw provider bodies.
    """
    if isinstance(exc, TickerNotFoundError):
        return HTTPException(status_code=404, detail=f"Ticker {ticker} not found")
    if isinstance(exc, PremiumTickerError) or (
        isinstance(exc, PermissionError) and "premium" in str(exc).lower()
    ):
        return HTTPException(
            status_code=422,
            detail=(
                "This ticker is not supported on the free data tier. "
                "Try a US-listed equity like AAPL, MSFT, or JPM."
            ),
        )
    if isinstance(exc, QuotaExhaustedError):
        return HTTPException(
            status_code=503,
            detail=(
                "Daily market-data quota reached. Previously analysed tickers "
                "remain available from cache; new tickers can be analysed after "
                "00:00 UTC."
            ),
            headers={"Retry-After": str(_seconds_until_utc_midnight())},
        )
    if isinstance(exc, (InvalidApiKeyError, PermissionError)):
        logger.error("Upstream authentication failure: %s", type(exc).__name__)
        return HTTPException(
            status_code=503,
            detail="Data provider authentication error. The operator has been notified in logs.",
        )
    if isinstance(exc, (ProviderUnavailableError, FmpProviderError, RuntimeError)):
        logger.warning("Upstream provider failure for %s: %s", ticker, exc)
        return HTTPException(
            status_code=502,
            detail="The market-data provider is temporarily unavailable. Try again shortly.",
            headers={"Retry-After": "30"},
        )
    logger.exception("Unexpected error for %s", ticker)
    return HTTPException(
        status_code=500,
        detail=f"Unexpected error while analysing {ticker}.",
    )


def _call_upstream(ticker: str, fn: Callable[[], T]) -> T:
    try:
        return fn()
    except (HTTPException, ValueError):
        # ValueError is a domain signal ("insufficient data") handled by callers.
        raise
    except Exception as exc:  # noqa: BLE001 — mapped to a typed HTTP error
        raise _upstream_http_error(exc, ticker) from None


def _fetch_all(ticker: str) -> dict:
    ticker = _normalize_symbol(ticker)
    result = _call_upstream(ticker, lambda: _fetcher.get_all_for_ticker(ticker))
    if result is None:
        raise HTTPException(status_code=404, detail=f"Ticker {ticker} not found")
    return result


def _parse_peers(peers: str | None) -> list[str] | None:
    if peers is None:
        return None
    raw_items = [p.strip().upper() for p in re.split(r"[,\s]+", peers) if p.strip()]
    items = list(dict.fromkeys(raw_items))
    if len(items) > MAX_CUSTOM_PEERS:
        raise HTTPException(
            status_code=422,
            detail=f"Use at most {MAX_CUSTOM_PEERS} custom peers.",
        )
    invalid = [item for item in items if not SYMBOL_PATTERN.fullmatch(item)]
    if invalid:
        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid peer ticker format: "
                + ", ".join(invalid[:3])
                + ". Use letters, numbers, dot, or hyphen."
            ),
        )
    return items or None


def _require_dcf_sector(financials: dict, label: str) -> None:
    sector = (financials.get("profile") or {}).get("sector")
    if _ddm.should_use_ddm(sector):
        raise HTTPException(
            status_code=422,
            detail=(
                f"{label} is not applicable for this sector. "
                "Financial institutions and REITs are valued with DDM, not DCF."
            ),
        )


@router.get("/{ticker}/profile", response_model=CompanyProfile)
def get_profile(ticker: str) -> dict:
    ticker = _normalize_symbol(ticker)
    profile = _call_upstream(ticker, lambda: _fetcher.get_profile(ticker))
    if profile is None:
        raise HTTPException(status_code=404, detail=f"Ticker {ticker} not found")
    return profile


@router.get("/{ticker}/financials", response_model=FinancialStatement)
def get_financials(ticker: str) -> dict:
    return _fetch_all(ticker)


@router.get("/{ticker}/dcf", response_model=DCFResult)
def get_dcf_auto(ticker: str) -> dict:
    financials = _fetch_all(ticker)
    assumptions = _dcf.compute_assumptions_from_history(financials)
    try:
        return _dcf.run_dcf(financials, assumptions)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{ticker}/dcf", response_model=DCFResult)
def post_dcf_custom(ticker: str, overrides: DCFAssumptions) -> dict:
    financials = _fetch_all(ticker)
    assumptions = _dcf.compute_assumptions_from_history(financials)
    overrides_dict = overrides.model_dump(exclude_none=True)
    # If the user overrides WACC, the auto-derived breakdown is no longer truthful
    # — clear it so the response doesn't claim a derivation that wasn't used.
    if "wacc" in overrides_dict:
        assumptions["wacc_breakdown"] = None
    assumptions.update(overrides_dict)
    try:
        return _dcf.run_dcf(financials, assumptions)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/{ticker}/multiples", response_model=MultiplesResult)
def get_multiples(
    ticker: str,
    peers: str | None = Query(default=None, description="Comma-separated peer tickers"),
) -> dict:
    ticker = _normalize_symbol(ticker)
    custom_peers = _parse_peers(peers)
    try:
        return _call_upstream(
            ticker, lambda: _multiples.valuate_with_multiples(ticker, custom_peers)
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/{ticker}/full", response_model=FullValuation)
def get_full_valuation(ticker: str) -> dict:
    # One logical "fetch everything" call up front. The fetcher's cache means
    # MultiplesValuator's downstream call for the same target hits the cache,
    # not FMP — keeps quota usage to ~1 target + N peers per /full request.
    financials = _fetch_all(ticker)
    ticker = _normalize_symbol(ticker)
    profile = financials["profile"]
    use_ddm = _ddm.should_use_ddm(profile.get("sector"))

    dcf_result = None
    ddm_result = None
    notices: list[str] = []

    # A model that cannot run (e.g. no positive revenue) is disclosed as a
    # notice instead of failing the whole report — comparables may still work.
    if use_ddm:
        try:
            ddm_result = _ddm.run_ddm(
                financials, _ddm.compute_assumptions_from_history(financials)
            )
        except ValueError as exc:
            notices.append(f"DDM unavailable: {exc}")
    else:
        try:
            dcf_result = _dcf.run_dcf(
                financials, _dcf.compute_assumptions_from_history(financials)
            )
        except ValueError as exc:
            notices.append(f"DCF unavailable: {exc}")

    multiples_result = None
    try:
        multiples_result = _call_upstream(
            ticker, lambda: _multiples.valuate_with_multiples(ticker)
        )
    except ValueError as exc:
        notices.append(f"Trading comparables unavailable: {exc}")

    if profile.get("served_stale"):
        notices.append(
            "The market-data provider was unavailable; figures are served from "
            "the most recent cached copy."
        )

    return {
        "profile": profile,
        "dcf": dcf_result,
        "ddm": ddm_result,
        "multiples": multiples_result,
        "primary_model": "ddm" if use_ddm else "dcf",
        "notices": notices,
    }


@router.get("/{ticker}/historical-financials")
def get_historical_financials(ticker: str) -> dict:
    """Return up to 5 years of historical income items in chronological order.

    Missing line items are returned as null — never as zero — so a chart can
    show a gap instead of a fabricated value.
    """
    bundle = _fetch_all(ticker)
    income = bundle.get("income_statement") or []

    sorted_income = sorted(
        (item for item in income if item.get("year") is not None),
        key=lambda x: x["year"],
    )

    if not sorted_income:
        raise HTTPException(
            status_code=404,
            detail=f"No historical data for {ticker.upper()}",
        )

    data = [
        {
            "year": int(item["year"]),
            "revenue": item.get("revenue"),
            "ebitda": item.get("ebitda"),
            "net_income": item.get("net_income"),
            "operating_income": item.get("operating_income"),
        }
        for item in sorted_income
    ]

    return {
        "symbol": ticker.upper(),
        "currency": sorted_income[-1].get("currency"),
        "historical": data,
    }


@router.get("/{ticker}/sensitivity")
def get_sensitivity(ticker: str) -> dict:
    """Compute DCF per-share value across a 5×5 WACC × terminal-growth grid
    centred on the company's own base-case assumptions.

    Returns 422 with a clear message if the ticker's sector uses DDM instead of DCF.
    """
    financials = _fetch_all(ticker)
    _require_dcf_sector(financials, "Sensitivity analysis")
    base_assumptions = _dcf.compute_assumptions_from_history(financials)
    base_wacc = float(base_assumptions["wacc"])
    base_tg = float(base_assumptions["terminal_growth_rate"])

    wacc_values = [base_wacc + step for step in SENSITIVITY_WACC_STEPS]
    terminal_growth_values = [base_tg + step for step in SENSITIVITY_TG_STEPS]

    try:
        table = _dcf.sensitivity_table(
            financials,
            base_assumptions,
            wacc_range=wacc_values,
            terminal_growth_range=terminal_growth_values,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # sensitivity_table returns matrix[wacc_idx][tg_idx]; transpose to
    # grid[tg_idx][wacc_idx] so the frontend can render rows = terminal growth.
    matrix = table["matrix"]
    grid: list[list[float | None]] = [
        [matrix[wi][ti] for wi in range(len(wacc_values))]
        for ti in range(len(terminal_growth_values))
    ]

    return {
        "symbol": ticker.upper(),
        "wacc_values": wacc_values,
        "terminal_growth_values": terminal_growth_values,
        "base_wacc": base_wacc,
        "base_terminal_growth": base_tg,
        "grid": grid,
        "current_price": (financials.get("profile") or {}).get("price"),
    }


@router.get("/{ticker}/reverse-dcf", response_model=ReverseDCFResult)
def get_reverse_dcf(
    ticker: str,
    target_price: float | None = Query(
        default=None,
        gt=0,
        le=10_000_000,
        description="Target price for reverse DCF",
    ),
) -> dict:
    """Solve for the implied revenue growth rate that justifies a given price.

    Returns 422 with a clear message if the ticker's sector uses DDM instead of DCF.
    """
    financials = _fetch_all(ticker)
    _require_dcf_sector(financials, "Reverse DCF")
    assumptions = _dcf.compute_assumptions_from_history(financials)
    try:
        return _dcf.reverse_dcf(financials, assumptions, target_price=target_price)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/{ticker}/wacc-breakdown")
def get_wacc_breakdown(ticker: str) -> dict:
    """Return the WACC breakdown for the given ticker, with sources cited."""
    bundle = _fetch_all(ticker)
    profile = bundle["profile"]
    income = bundle.get("income_statement") or []
    balance = bundle.get("balance_sheet") or []

    # Effective tax rate from the latest income statement, clamped to [0%, 35%].
    tax_rate = 0.21
    if income:
        pretax = income[0].get("pretax_income")
        tax = income[0].get("income_tax")
        if pretax and pretax > 0 and tax is not None:
            tax_rate = max(0.0, min(0.35, tax / pretax))

    interest_exp = income[0].get("interest_expense") if income else None
    total_debt = balance[0].get("total_debt") if balance else None

    wacc_result = compute_wacc(
        market_cap=profile.get("market_cap"),
        total_debt=total_debt,
        beta=profile.get("beta"),
        interest_expense=interest_exp,
        tax_rate=tax_rate,
    )

    return {
        "symbol": ticker.upper(),
        "wacc": wacc_result["wacc"],
        "breakdown": wacc_result["breakdown"],
        "data_stale": is_data_stale(),
        "warning": wacc_result.get("warning"),
    }


@router.get("/{ticker}/ddm")
def get_ddm(ticker: str) -> dict:
    """Compute DDM valuation for dividend-paying stocks (banks, REITs, financials)."""
    financials = _fetch_all(ticker)
    assumptions = _ddm.compute_assumptions_from_history(financials)
    try:
        return _ddm.run_ddm(financials, assumptions)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

