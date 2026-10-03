"""Financial model tests: every expected value is recomputed independently."""

import math

import pytest

from app.services.dcf import GROWTH_CAP, DCFValuator
from app.services.ddm import DDMValuator
from app.services.multiples import MultiplesValuator, _filter_quality_peers
from app.services.wacc import compute_wacc

dcf = DCFValuator()
ddm = DDMValuator()


def _bundle(revenue=1000.0, debt=200.0, cash=50.0, shares=100.0, price=20.0, sector="Technology"):
    return {
        "profile": {
            "price": price, "shares_outstanding": shares, "market_cap": price * shares,
            "beta": 1.0, "sector": sector,
        },
        "income_statement": [{"date": "2025-12-31", "revenue": revenue}],
        "balance_sheet": [{"total_debt": debt, "cash": cash}],
        "cash_flow": [],
    }


BASE = {
    "revenue_growth_rates": [0.10, 0.08, 0.06, 0.05, 0.04],
    "ebit_margin": 0.20,
    "tax_rate": 0.25,
    "da_pct_revenue": 0.05,
    "capex_pct_revenue": 0.06,
    "wc_change_pct_revenue": 0.01,
    "wacc": 0.09,
    "terminal_growth_rate": 0.025,
    "warnings": [],
}


def _hand_dcf(revenue, a, debt, cash, shares):
    rev = revenue
    pv = 0.0
    fcff = 0.0
    for t, g in enumerate(a["revenue_growth_rates"], start=1):
        rev *= 1 + g
        fcff = (rev * a["ebit_margin"] * (1 - a["tax_rate"])
                + rev * (a["da_pct_revenue"] - a["capex_pct_revenue"] - a["wc_change_pct_revenue"]))
        pv += fcff / (1 + a["wacc"]) ** t
    tv = fcff * (1 + a["terminal_growth_rate"]) / (a["wacc"] - a["terminal_growth_rate"])
    ev = pv + tv / (1 + a["wacc"]) ** 5
    return ev, (ev - (debt - cash)) / shares


class TestDCF:
    def test_matches_independent_calculation(self):
        result = dcf.run_dcf(_bundle(), dict(BASE))
        ev, per_share = _hand_dcf(1000.0, BASE, 200.0, 50.0, 100.0)
        assert result["enterprise_value"] == pytest.approx(ev, rel=1e-12)
        assert result["per_share_value"] == pytest.approx(per_share, rel=1e-12)
        assert result["net_debt"] == pytest.approx(150.0)
        assert result["upside_pct"] == pytest.approx((per_share - 20.0) / 20.0)

    def test_range_brackets_base_value(self):
        result = dcf.run_dcf(_bundle(), dict(BASE))
        a = result["assumptions_used"]
        assert a["per_share_low"] < result["per_share_value"] < a["per_share_high"]

    def test_wacc_must_exceed_terminal_growth(self):
        with pytest.raises(ValueError):
            dcf.run_dcf(_bundle(), {**BASE, "wacc": 0.02, "terminal_growth_rate": 0.025})

    @pytest.mark.parametrize("revenue", [0.0, -5.0, None])
    def test_non_positive_revenue_is_rejected(self, revenue):
        with pytest.raises(ValueError):
            dcf.run_dcf(_bundle(revenue=revenue), dict(BASE))

    def test_non_finite_growth_is_rejected(self):
        with pytest.raises(ValueError):
            dcf.run_dcf(_bundle(), {**BASE, "revenue_growth_rates": [math.nan] * 5})

    def test_missing_shares_gives_none_not_crash(self):
        b = _bundle()
        b["profile"]["shares_outstanding"] = None
        result = dcf.run_dcf(b, dict(BASE))
        assert result["per_share_value"] is None
        assert any("Shares outstanding" in w for w in result["warnings"])

    def test_missing_balance_sheet_assumes_zero_and_warns(self):
        b = _bundle()
        b["balance_sheet"] = []
        result = dcf.run_dcf(b, dict(BASE))
        assert result["net_debt"] == 0.0
        assert len([w for w in result["warnings"] if "assumed 0" in w]) == 2

    def test_negative_margin_stays_finite_and_warns(self):
        result = dcf.run_dcf(_bundle(), {**BASE, "ebit_margin": -0.3})
        assert math.isfinite(result["per_share_value"])
        assert result["per_share_value"] < 0

    def test_extreme_values_stay_finite(self):
        result = dcf.run_dcf(_bundle(revenue=4e12, shares=1.0), {**BASE, "wacc": 0.0251})
        assert all(math.isfinite(result[k]) for k in ("enterprise_value", "per_share_value"))


class TestDCFAssumptions:
    def _history(self, revenues):
        return {
            "profile": {"market_cap": 1e9, "beta": 1.2, "price": 10, "shares_outstanding": 1e8},
            "income_statement": [
                {"date": f"{2025 - i}-12-31", "revenue": r, "ebit": r * 0.2,
                 "pretax_income": r * 0.18, "income_tax": r * 0.18 * 0.21,
                 "interest_expense": 1e6}
                for i, r in enumerate(revenues)
            ],
            "balance_sheet": [{"total_debt": 2e8, "cash": 5e7}],
            "cash_flow": [],
        }

    def test_growth_schedule_fades_to_terminal(self):
        a = dcf.compute_assumptions_from_history(self._history([150, 130, 115, 100]))
        rates = a["revenue_growth_rates"]
        assert rates == sorted(rates, reverse=True)
        assert rates[-1] == a["terminal_growth_rate"]
        assert a["historical_cagr_3y"] == pytest.approx(1.5 ** (1 / 3) - 1)
        assert a["income_date"] == "2025-12-31"

    def test_hyper_growth_is_capped(self):
        a = dcf.compute_assumptions_from_history(self._history([800, 400, 200, 100]))
        assert a["revenue_growth_rates"][0] == GROWTH_CAP

    def test_shrinking_company_floored_above_terminal(self):
        a = dcf.compute_assumptions_from_history(self._history([80, 90, 95, 100]))
        assert a["revenue_growth_rates"][0] == pytest.approx(a["terminal_growth_rate"] + 0.01)

    def test_missing_cash_flow_uses_disclosed_defaults(self):
        a = dcf.compute_assumptions_from_history(self._history([110, 100]))
        assert any("unavailable; using default" in w for w in a["warnings"])


class TestSensitivityAndReverse:
    def test_sensitivity_skips_invalid_cells(self):
        table = dcf.sensitivity_table(_bundle(), dict(BASE), [0.02, 0.09], [0.025, 0.03])
        assert table["matrix"][0] == [None, None]
        assert all(v is not None for v in table["matrix"][1])

    def test_reverse_dcf_reproduces_target_price(self):
        target = 30.0
        result = dcf.reverse_dcf(_bundle(), dict(BASE), target_price=target)
        assert result["solver_status"] == "solved"
        implied = result["implied_growth_rate"]
        check = dcf.run_dcf(_bundle(), {**BASE, "revenue_growth_rates": [implied] * 5})
        assert check["per_share_value"] == pytest.approx(target, rel=2e-3)

    def test_reverse_dcf_flags_out_of_range(self):
        result = dcf.reverse_dcf(_bundle(), dict(BASE), target_price=1e6)
        assert result["solver_status"] == "above_range"


class TestWACC:
    def test_weights_and_formula(self):
        r = compute_wacc(market_cap=800, total_debt=200, beta=1.2,
                         interest_expense=10, tax_rate=0.25)
        b = r["breakdown"]
        from app.config import WACC_INPUTS

        re = float(WACC_INPUTS["risk_free_rate"]) + 1.2 * float(WACC_INPUTS["equity_risk_premium"])
        rd = 10 / 200
        assert r["wacc"] == pytest.approx(0.8 * re + 0.2 * rd * 0.75)
        assert b["weight_equity"] + b["weight_debt"] == pytest.approx(1.0)

    def test_missing_market_cap_returns_warning(self):
        assert compute_wacc(None, 100, 1.0, 5)["wacc"] is None

    @pytest.mark.parametrize("beta", [None, 0, -0.4])
    def test_invalid_beta_defaults_to_market(self, beta):
        r = compute_wacc(1000, 0, beta, None)
        assert r["breakdown"]["beta"] == 1.0
        assert r["breakdown"]["beta_source"].startswith("market default")


class TestDDM:
    def _bank(self, dividends):
        return {
            "profile": {"price": 50.0, "shares_outstanding": 100.0, "market_cap": 5000.0,
                        "beta": 1.0, "sector": "Financial Services"},
            "income_statement": [{"date": "2025-12-31", "net_income": 400.0,
                                  "pretax_income": 500.0, "income_tax": 100.0}],
            "balance_sheet": [{"total_debt": 1000.0}],
            "cash_flow": [{"dividends_paid": -d} for d in dividends],
        }

    def test_matches_independent_calculation(self):
        bank = self._bank([200.0, 190.0, 180.0, 170.0, 160.0])
        a = ddm.compute_assumptions_from_history(bank)
        g = (200 / 160) ** (1 / 4) - 1
        assert a["dividend_growth_rate"] == pytest.approx(g)
        assert a["latest_dps"] == pytest.approx(2.0)
        assert a["payout_ratio"] == pytest.approx(0.5)
        result = ddm.run_ddm(bank, a)
        re, tg = a["cost_of_equity"], a["terminal_growth_rate"]
        dps, pv = 2.0, 0.0
        for t in range(1, 6):
            dps *= 1 + g
            pv += dps / (1 + re) ** t
        pv += dps * (1 + tg) / (re - tg) / (1 + re) ** 5
        assert result["per_share_value"] == pytest.approx(pv, rel=1e-12)
        assert result["dividend_yield"] == pytest.approx(2.0 / 50.0)

    def test_non_payer_returns_placeholder_not_zero(self):
        bank = self._bank([0.0, 0.0])
        result = ddm.run_ddm(bank, ddm.compute_assumptions_from_history(bank))
        assert result["per_share_value"] is None
        assert any("dividend" in w.lower() for w in result["warnings"])

    def test_sector_routing(self):
        assert ddm.should_use_ddm("Financial Services")
        assert ddm.should_use_ddm(" Real Estate ")
        assert not ddm.should_use_ddm("Technology")
        assert not ddm.should_use_ddm(None)


class TestMultiples:
    def test_peer_size_filter_and_order(self):
        peers = [
            {"symbol": "big", "mktCap": 5e12},
            {"symbol": "ok1", "mktCap": 2e10},
            {"symbol": "ok2", "mktCap": 5e10},
            {"symbol": "tiny", "mktCap": 1e6},
            {"symbol": "bad", "mktCap": "n/a"},
            {"symbol": "neg", "mktCap": -1},
        ]
        assert _filter_quality_peers(1e10, peers) == ["OK2", "OK1"]

    def test_ev_multiple_subtracts_net_debt(self):
        r = MultiplesValuator._implied_from_ev_multiple(100.0, 10.0, net_debt=200.0, shares=8.0)
        assert r["implied_enterprise_value"] == 1000.0
        assert r["implied_per_share"] == pytest.approx(100.0)

    @pytest.mark.parametrize("metric", [None, 0.0, -50.0])
    def test_non_positive_metric_has_no_implied_value(self, metric):
        assert MultiplesValuator._implied_from_equity_multiple(metric, 20.0, 10.0) is None

    def test_peer_statistics_exclude_negative_multiples(self):
        result = MultiplesValuator().valuate_with_multiples("NWND")
        pe = result["peer_statistics"]["statistics"]["pe_ratio"]
        # KSTR has a negative P/E and must not enter the statistics.
        assert pe["count"] == 4
        assert pe["median"] == pytest.approx(27.75)  # median of 19.4, 24.0, 31.5, 36.2
        assert result["peers_used"][0] == "LMNA"  # largest market cap first
        assert "NWND" not in result["peers_used"]
        assert "TINY" not in result["peers_used"]  # < 1% of target size

    def test_peer_with_full_ttm_needs_three_calls(self):
        from app.services.data_fetcher import FinancialDataFetcher as F
        MultiplesValuator().compute_peer_multiples("ORBT")
        assert F.upstream_calls == 3

    def test_peer_missing_ttm_falls_back_to_statements(self):
        row = MultiplesValuator().compute_peer_multiples("PYLN")
        assert row["ev_ebitda"] is not None and row["ev_ebitda"] > 0
        assert row["revenue"] is not None
