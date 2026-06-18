import pytest
from app.services.wacc import compute_wacc


class TestWaccNegativeInterestExpense:
    """Phase 1.5 regression: negative interest expense (cash/interest income) must not force default cost of debt."""

    def test_negative_interest_expense_uses_abs(self):
        """When interest_expense is negative, cost of debt should be derived from abs(interest_expense)."""
        result = compute_wacc(
            market_cap=500_000_000,
            total_debt=100_000_000,
            beta=1.2,
            interest_expense=-5_000_000,  # negative: company earns interest
            tax_rate=0.21,
        )
        # cost_of_debt = abs(-5M) / 100M = 5%
        assert result["breakdown"]["cost_of_debt_pretax"] == pytest.approx(0.05, abs=1e-6)
        # WACC should be between Re and Rd (weighted)
        assert result["wacc"] is not None
        assert 0.05 < result["wacc"] < 0.11

    def test_positive_interest_expense_unchanged(self):
        """Positive interest expense should still produce the same cost of debt as before."""
        result = compute_wacc(
            market_cap=400_000_000,
            total_debt=200_000_000,
            beta=1.0,
            interest_expense=10_000_000,
            tax_rate=0.21,
        )
        assert result["breakdown"]["cost_of_debt_pretax"] == pytest.approx(0.05, abs=1e-6)

    def test_zero_interest_expense(self):
        """Zero interest expense yields cost_of_debt clamped to minimum 1% (not default)."""
        result = compute_wacc(
            market_cap=300_000_000,
            total_debt=100_000_000,
            beta=1.0,
            interest_expense=0,
            tax_rate=0.21,
        )
        # abs(0)/100M = 0, clamped to minimum 0.01
        assert result["breakdown"]["cost_of_debt_pretax"] == pytest.approx(0.01, abs=1e-6)

    def test_none_interest_expense_uses_default(self):
        """None interest_expense should fall back to default cost of debt from config."""
        result = compute_wacc(
            market_cap=300_000_000,
            total_debt=100_000_000,
            beta=1.0,
            interest_expense=None,
            tax_rate=0.21,
        )
        # Default comes from WACC_INPUTS config; assert it is the configured default
        from app.config import WACC_INPUTS
        expected_default = float(WACC_INPUTS["default_cost_of_debt_pretax"])
        assert result["breakdown"]["cost_of_debt_pretax"] == pytest.approx(expected_default, abs=1e-6)
