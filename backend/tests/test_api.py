"""HTTP-level behaviour against fixtures (no network)."""

import logging
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import RateLimitMiddleware, app
from app.services.data_fetcher import FinancialDataFetcher as F

client = TestClient(app)


def test_full_dcf_report_shape():
    r = client.get("/api/valuation/nwnd/full")
    assert r.status_code == 200
    body = r.json()
    assert body["primary_model"] == "dcf"
    assert body["ddm"] is None
    assert body["notices"] == []
    assert body["profile"]["data_as_of"] is not None
    assert body["dcf"]["assumptions_used"]["income_date"] == "2025-12-31"
    assert body["multiples"]["peers_used"] == ["LMNA", "ORBT", "CRST", "PYLN", "KSTR"]


def test_full_bank_uses_ddm_with_stable_dividend_fields():
    body = client.get("/api/valuation/HRBR/full").json()
    assert body["primary_model"] == "ddm"
    assert body["dcf"] is None
    # commonDividendsPaid (FMP /stable) must be found: 1.08bn / 400m shares.
    assert body["ddm"]["latest_dps"] == pytest.approx(1.08e9 / (23.28e9 / 58.2))
    assert body["ddm"]["per_share_value"] is not None


def test_pre_revenue_company_degrades_to_notice():
    r = client.get("/api/valuation/ZERO/full")
    assert r.status_code == 200
    assert r.json()["dcf"] is None
    assert any(n.startswith("DCF unavailable") for n in r.json()["notices"])


def test_company_without_statements_still_renders_profile():
    body = client.get("/api/valuation/THIN/full").json()
    assert body["dcf"] is None and body["multiples"] is None
    assert len(body["notices"]) == 2


@pytest.mark.parametrize(
    "ticker,status",
    [("NOPE", 404), ("PREM", 422), ("DOWN", 502), ("RATE", 503), ("bad$$", 422), ("TOOLONGTICKER1", 422)],
)
def test_error_mapping(ticker, status):
    r = client.get(f"/api/valuation/{ticker}/full")
    assert r.status_code == status
    detail = r.json()["detail"]
    assert "apikey" not in str(detail).lower()
    assert "fixture" not in str(detail).lower()
    if status == 503:
        assert int(r.headers["Retry-After"]) >= 60


def test_historical_is_chronological_and_keeps_gaps():
    body = client.get("/api/valuation/LOSS/historical-financials").json()
    years = [row["year"] for row in body["historical"]]
    assert years == sorted(years) == [2021, 2022, 2023, 2024, 2025]
    # EBITDA is missing in the fixture: it must be null, never 0.
    assert all(row["ebitda"] is None for row in body["historical"])
    assert body["currency"] == "USD"


def test_sensitivity_centre_equals_headline_dcf():
    full = client.get("/api/valuation/NWND/full").json()
    sens = client.get("/api/valuation/NWND/sensitivity").json()
    assert sens["wacc_values"][2] == pytest.approx(sens["base_wacc"])
    assert sens["grid"][2][2] == pytest.approx(full["dcf"]["per_share_value"])
    # Value falls as WACC rises along the base-growth row.
    row = sens["grid"][2]
    assert row == sorted(row, reverse=True)


def test_dcf_only_endpoints_reject_banks():
    assert client.get("/api/valuation/HRBR/sensitivity").status_code == 422
    assert client.get("/api/valuation/HRBR/reverse-dcf").status_code == 422


def test_parallel_page_requests_cost_one_bundle():
    """The valuation page fires four requests at once; they must share fetches."""
    paths = ["full", "historical-financials", "sensitivity", "reverse-dcf"]
    with ThreadPoolExecutor(max_workers=4) as pool:
        codes = list(pool.map(lambda p: client.get(f"/api/valuation/NWND/{p}").status_code, paths))
    assert codes == [200, 200, 200, 200]
    # 6 target calls + 1 peer list + 4 peers × 3 + PYLN statement fallback × 3
    assert F.upstream_calls == 6 + 1 + 4 * 3 + 6


def test_custom_dcf_validation():
    ok = client.post("/api/valuation/NWND/dcf", json={"wacc": 0.1, "terminal_growth_rate": 0.02})
    assert ok.status_code == 200
    assert ok.json()["wacc_breakdown"] is None  # override → derivation no longer claimed
    assert client.post("/api/valuation/NWND/dcf", json={"wacc": 0.9}).status_code == 422
    assert client.post(
        "/api/valuation/NWND/dcf", json={"revenue_growth_rates": [5, 0, 0, 0, 0]}
    ).status_code == 422
    assert client.post(
        "/api/valuation/NWND/dcf", json={"revenue_growth_rates": [0.1, 0.1]}
    ).status_code == 422
    assert client.post(
        "/api/valuation/NWND/dcf", json={"wacc": 0.03, "terminal_growth_rate": 0.05}
    ).status_code == 400


def test_custom_peers_validation():
    assert client.get("/api/valuation/NWND/multiples?peers=" + ",".join(f"P{i}" for i in range(9))).status_code == 422
    assert client.get("/api/valuation/NWND/multiples?peers=GOOD,b@d").status_code == 422
    r = client.get("/api/valuation/NWND/multiples?peers=ORBT,NWND,orbt")
    assert r.status_code == 200
    assert r.json()["peers_used"] == ["ORBT"]
    assert r.json()["peer_source"] == "custom"


def test_reverse_dcf_target_bounds():
    assert client.get("/api/valuation/NWND/reverse-dcf?target_price=-1").status_code == 422
    assert client.get("/api/valuation/NWND/reverse-dcf?target_price=1e9").status_code == 422
    assert client.get("/api/valuation/NWND/reverse-dcf?target_price=150").status_code == 200


def test_cors_allows_project_origins_only():
    good = client.options(
        "/api/valuation/NWND/full",
        headers={"Origin": "https://valuation-tool-git-main-x.vercel.app",
                 "Access-Control-Request-Method": "GET"},
    )
    assert good.headers.get("access-control-allow-origin") == "https://valuation-tool-git-main-x.vercel.app"
    bad = client.options(
        "/api/valuation/NWND/full",
        headers={"Origin": "https://evil.vercel.app", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in bad.headers


def test_httpx_url_logging_is_suppressed():
    assert logging.getLogger("httpx").getEffectiveLevel() >= logging.WARNING


def test_rate_limiter_blocks_and_sets_retry_after():
    mini = FastAPI()
    mini.add_middleware(RateLimitMiddleware, requests_per_window=3, window_seconds=60)

    @mini.get("/api/valuation/x")
    def x() -> dict:
        return {"ok": True}

    @mini.get("/health")
    def h() -> dict:
        return {"ok": True}

    c = TestClient(mini)
    assert [c.get("/api/valuation/x").status_code for _ in range(4)] == [200, 200, 200, 429]
    assert int(c.get("/api/valuation/x").headers["Retry-After"]) >= 1
    assert c.get("/health").status_code == 200  # non-valuation paths are exempt
