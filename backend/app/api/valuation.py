"""FastAPI router for the valuation endpoints."""

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import (
    CompanyProfile,
    DCFAssumptions,
    DCFResult,
    FinancialStatement,
    FullValuation,
    MultiplesResult,
)
from app.services.data_fetcher import FinancialDataFetcher
from app.services.dcf import DCFValuator
from app.services.multiples import MultiplesValuator


router = APIRouter(prefix="/api/valuation", tags=["valuation"])

_fetcher = FinancialDataFetcher()
_dcf = DCFValuator()
_multiples = MultiplesValuator(_fetcher)


def _upstream_http_error(exc: Exception, ticker: str) -> HTTPException:
    """Translate fetcher exceptions into HTTP responses.

    - PermissionError → 503 (our API key is bad — operator problem, not the user's).
    - RuntimeError mentioning "rate limit" → 429 (transient, retry later).
    - Other RuntimeError → 503 (upstream issue).
    """
    if isinstance(exc, PermissionError):
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
    items = [p.strip().upper() for p in peers.split(",") if p.strip()]
    return items or None


@router.get("/{ticker}/profile", response_model=CompanyProfile)
def get_profile(ticker: str) -> dict:
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

    return {"profile": profile, "dcf": dcf_result, "multiples": multiples_result}
