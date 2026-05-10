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


def _fetch_financials(ticker: str) -> dict:
    try:
        return _fetcher.get_all_financials(ticker)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch data for {ticker}: {exc}")


def _parse_peers(peers: str | None) -> list[str] | None:
    if peers is None:
        return None
    items = [p.strip().upper() for p in peers.split(",") if p.strip()]
    return items or None


@router.get("/{ticker}/profile", response_model=CompanyProfile)
def get_profile(ticker: str) -> dict:
    try:
        return _fetcher.get_company_profile(ticker)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {exc}")


@router.get("/{ticker}/financials", response_model=FinancialStatement)
def get_financials(ticker: str) -> dict:
    return _fetch_financials(ticker)


@router.get("/{ticker}/dcf", response_model=DCFResult)
def get_dcf_auto(ticker: str) -> dict:
    financials = _fetch_financials(ticker)
    assumptions = _dcf.compute_assumptions_from_history(financials)
    try:
        return _dcf.run_dcf(financials, assumptions)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{ticker}/dcf", response_model=DCFResult)
def post_dcf_custom(ticker: str, overrides: DCFAssumptions) -> dict:
    financials = _fetch_financials(ticker)
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
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Multiples valuation failed: {exc}")


@router.get("/{ticker}/full", response_model=FullValuation)
def get_full_valuation(ticker: str) -> dict:
    financials = _fetch_financials(ticker)
    profile = financials["profile"]

    assumptions = _dcf.compute_assumptions_from_history(financials)
    try:
        dcf_result = _dcf.run_dcf(financials, assumptions)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        multiples_result = _multiples.valuate_with_multiples(ticker)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Multiples valuation failed: {exc}")

    return {"profile": profile, "dcf": dcf_result, "multiples": multiples_result}
