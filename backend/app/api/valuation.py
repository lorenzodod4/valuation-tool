"""FastAPI router for the valuation endpoints."""

import re

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
from app.services.data_fetcher import FinancialDataFetcher
from app.services.dcf import DCFValuator
from app.services.ddm import DDMValuator
from app.services.multiples import MultiplesValuator
from app.services.wacc import compute_wacc, is_data_stale


router = APIRouter(prefix="/api/valuation", tags=["valuation"])

_fetcher = FinancialDataFetcher()
_dcf = DCFValuator()
_ddm = DDMValuator()
_multiples = MultiplesValuator(_fetcher)

SYMBOL_PATTERN = re.compile(r"^[A-Z0-9][A-Z0-9.-]{0,9}$")
MAX_CUSTOM_PEERS = 8


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


def _upstream_http_error(exc: Exception, ticker: str) -> HTTPException:
    """Translate fetcher exceptions into HTTP responses.

    - PermissionError mentioning "premium" → 422 (user picked an unsupported ticker).
    - Other PermissionError → 503 (our API key is bad — operator problem).
    - RuntimeError mentioning "rate limit" → 429 (transient, retry later).
    - Other RuntimeError → 503 (upstream issue).
    """
    if isinstance(exc, PermissionError):
        msg = str(exc)
        if "premium" in msg.lower() or "not supported" in msg.lower():
            return HTTPException(
                status_code=422,
                detail=(
                    "This ticker is not supported on the free tier. "
                    "Try a US-listed equity like AAPL, MSFT, or JPM."
                ),
            )
        return HTTPException(
            status_code=503,
            detail="Upstream data provider authentication error",
        )
    if isinstance(exc, RuntimeError):
        msg = str(exc)
        if "rate limit" in msg.lower():
            return HTTPException(
                status_code=429,
                detail="Upstream rate limit reached. Try again later.",
            )
        return HTTPException(
            status_code=503,
            detail=f"Upstream data provider error: {msg}",
        )
    return HTTPException(
        status_code=500,
        detail=f"Failed to fetch data for {ticker}: {exc}",
    )


def _fetch_all(ticker: str) -> dict:
    ticker = _normalize_symbol(ticker)
    try:
        result = _fetcher.get_all_for_ticker(ticker)
    except (PermissionError, RuntimeError) as exc:
        raise _upstream_http_error(exc, ticker)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch data for {ticker}: {exc}"
        )
    if result is None:
        raise HTTPException(
            status_code=404, detail=f"Ticker {ticker.upper()} not found"
        )
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


@router.get("/{ticker}/profile", response_model=CompanyProfile)
def get_profile(ticker: str) -> dict:
    ticker = _normalize_symbol(ticker)
    try:
        profile = _fetcher.get_profile(ticker)
    except (PermissionError, RuntimeError) as exc:
        raise _upstream_http_error(exc, ticker)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {exc}")
    if profile is None:
        raise HTTPException(
            status_code=404, detail=f"Ticker {ticker.upper()} not found"
        )
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
        return _multiples.valuate_with_multiples(ticker, custom_peers)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except (PermissionError, RuntimeError) as exc:
        raise _upstream_http_error(exc, ticker)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Multiples valuation failed: {exc}"
        )


@router.get("/{ticker}/full", response_model=FullValuation)
def get_full_valuation(ticker: str) -> dict:
    # One logical "fetch everything" call up front. The fetcher's cache means
    # MultiplesValuator's downstream call for the same target hits the cache,
    # not FMP — keeps quota usage to ~1 target + N peers per /full request.
    financials = _fetch_all(ticker)
    profile = financials["profile"]
    sector = profile.get("sector")

    # Determine whether to use DDM or DCF
    use_ddm = _ddm.should_use_ddm(sector)

    dcf_result = None
    ddm_result = None

    if use_ddm:
        # Use DDM for financial institutions
        assumptions = _ddm.compute_assumptions_from_history(financials)
        try:
            ddm_result = _ddm.run_ddm(financials, assumptions)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    else:
        # Use DCF for regular companies
        assumptions = _dcf.compute_assumptions_from_history(financials)
        try:
            dcf_result = _dcf.run_dcf(financials, assumptions)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    try:
        multiples_result = _multiples.valuate_with_multiples(ticker)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except (PermissionError, RuntimeError) as exc:
        raise _upstream_http_error(exc, ticker)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Multiples valuation failed: {exc}"
        )

    return {
        "profile": profile,
        "dcf": dcf_result,
        "ddm": ddm_result,
        "multiples": multiples_result,
        "primary_model": "ddm" if use_ddm else "dcf",
    }


@router.get("/{ticker}/historical-financials")
def get_historical_financials(ticker: str) -> dict:
    """Return 5 years of historical income items in chronological order."""
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
            "revenue": item.get("revenue") or 0,
            "ebitda": item.get("ebitda") or 0,
            "net_income": item.get("net_income") or 0,
            "operating_income": item.get("operating_income") or 0,
        }
        for item in sorted_income
    ]

    return {"symbol": ticker.upper(), "historical": data}


@router.get("/{ticker}/sensitivity")
def get_sensitivity(ticker: str) -> dict:
    """Compute DCF per-share value across a 5×5 WACC × terminal-growth grid.
    
    Returns 422 with a clear message if the ticker's sector uses DDM instead of DCF.
    """
    financials = _fetch_all(ticker)
    profile = financials.get("profile") or {}
    sector = profile.get("sector")
    if _ddm.should_use_ddm(sector):
        raise HTTPException(
            status_code=422,
            detail=(
                "Sensitivity analysis is not applicable for this sector. "
                "Financial institutions and REITs are valued with DDM, not DCF. "
                "Use the /ddm endpoint instead."
            ),
        )
    base_assumptions = _dcf.compute_assumptions_from_history(financials)

    wacc_values = [0.07, 0.08, 0.09, 0.10, 0.11]
    terminal_growth_values = [0.015, 0.020, 0.025, 0.030, 0.035]

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
    n_tg = len(terminal_growth_values)
    n_wacc = len(wacc_values)
    grid: list[list[float | None]] = [
        [matrix[wi][ti] for wi in range(n_wacc)] for ti in range(n_tg)
    ]

    profile = financials.get("profile") or {}

    return {
        "symbol": ticker.upper(),
        "wacc_values": wacc_values,
        "terminal_growth_values": terminal_growth_values,
        "grid": grid,
        "current_price": profile.get("price"),
    }


@router.get("/{ticker}/reverse-dcf", response_model=ReverseDCFResult)
def get_reverse_dcf(
    ticker: str,
    target_price: float | None = Query(
        default=None,
        gt=0,
        description="Target price for reverse DCF",
    ),
) -> dict:
    """Solve for the implied revenue growth rate that justifies a given price.
    
    Returns 422 with a clear message if the ticker's sector uses DDM instead of DCF.
    """
    financials = _fetch_all(ticker)
    profile = financials.get("profile") or {}
    sector = profile.get("sector")
    if _ddm.should_use_ddm(sector):
        raise HTTPException(
            status_code=422,
            detail=(
                "Reverse DCF is not applicable for this sector. "
                "Financial institutions and REITs are valued with DDM, not DCF. "
                "Use the /ddm endpoint instead."
            ),
        )
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
