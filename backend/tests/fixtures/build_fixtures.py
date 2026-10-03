"""Generate deterministic FMP-shaped fixtures for offline development and tests.

Every company here is FICTIONAL ("(Synthetic)" in the name). Field names follow
the FMP /stable schema (`fiscalYear`, `commonDividendsPaid`, `marketCap`, ...).
No real market data is stored in this repository.

Run:  python -m tests.fixtures.build_fixtures   (from backend/)
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "fmp"
YEARS = [2025, 2024, 2023, 2022, 2021]


def _write(endpoint: str, symbol: str, payload: object) -> None:
    path = ROOT / endpoint / f"{symbol}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n")


def _profile(symbol, name, sector, industry, price, market_cap, beta, description,
             exchange="NASDAQ"):
    return [{
        "symbol": symbol,
        "price": price,
        "marketCap": market_cap,
        "beta": beta,
        "companyName": name,
        "currency": "USD",
        "exchange": exchange,
        "exchangeFullName": "NASDAQ Global Select" if exchange == "NASDAQ" else "New York Stock Exchange",
        "industry": industry,
        "sector": sector,
        "country": "US",
        "description": description,
        "isEtf": False,
    }]


def _statements(symbol, revenues, ebit_margin, net_margin, da_pct, capex_pct,
                wc_pct, tax_rate, debt, cash, equity, interest, dividends=None,
                ebitda_missing=False):
    income, balance, cashflow = [], [], []
    for i, (year, revenue) in enumerate(zip(YEARS, revenues)):
        date = f"{year}-12-31"
        ebit = revenue * ebit_margin
        pretax = ebit - interest
        tax = pretax * tax_rate if pretax > 0 else 0.0
        income.append({
            "date": date, "symbol": symbol, "reportedCurrency": "USD",
            "fiscalYear": str(year), "period": "FY",
            "revenue": round(revenue),
            "operatingIncome": round(ebit),
            "ebitda": None if ebitda_missing else round(ebit + revenue * da_pct),
            "netIncome": round(revenue * net_margin),
            "incomeBeforeTax": round(pretax),
            "incomeTaxExpense": round(tax),
            "interestExpense": round(interest),
            "depreciationAndAmortization": round(revenue * da_pct),
        })
        balance.append({
            "date": date, "symbol": symbol, "reportedCurrency": "USD",
            "fiscalYear": str(year), "period": "FY",
            "totalDebt": round(debt), "cashAndCashEquivalents": round(cash),
            "totalStockholdersEquity": round(equity),
            "totalAssets": round(equity + debt * 1.6),
        })
        row = {
            "date": date, "symbol": symbol, "reportedCurrency": "USD",
            "fiscalYear": str(year), "period": "FY",
            "capitalExpenditure": -round(revenue * capex_pct),
            # FMP sign convention: negative = working capital consumed cash.
            "changeInWorkingCapital": -round(revenue * wc_pct),
            "depreciationAndAmortization": round(revenue * da_pct),
            "freeCashFlow": round(revenue * (net_margin + da_pct - capex_pct - wc_pct)),
        }
        if dividends is not None:
            row["commonDividendsPaid"] = -round(dividends[i])
            row["netDividendsPaid"] = -round(dividends[i] * 1.02)
            row["preferredDividendsPaid"] = -round(dividends[i] * 0.02)
        cashflow.append(row)
    _write("income-statement", symbol, income)
    _write("balance-sheet-statement", symbol, balance)
    _write("cash-flow-statement", symbol, cashflow)


def _ttm(symbol, pe, pb, peg, ev, ev_sales, ev_ebitda, market_cap):
    _write("ratios-ttm", symbol, [{
        "symbol": symbol,
        "priceToEarningsRatioTTM": pe,
        "priceToBookRatioTTM": pb,
        "priceToEarningsGrowthRatioTTM": peg,
    }])
    _write("key-metrics-ttm", symbol, [{
        "symbol": symbol,
        "marketCap": market_cap,
        "enterpriseValueTTM": ev,
        "evToSalesTTM": ev_sales,
        "evToEBITDATTM": ev_ebitda,
        "returnOnEquityTTM": 0.21,
        "returnOnAssetsTTM": 0.09,
    }])


def build() -> None:
    # --- NWND: profitable growth software company (DCF path) -------------
    _write("profile", "NWND", _profile(
        "NWND", "Northwind Systems (Synthetic)", "Technology", "Software - Application",
        142.50, 48_450_000_000, 1.15,
        "Fictional enterprise software vendor used as a deterministic fixture. "
        "Not a real company; all figures are synthetic.",
    ))
    _statements("NWND", [9.8e9, 8.75e9, 7.81e9, 6.98e9, 6.23e9], 0.22, 0.17,
                0.04, 0.035, 0.01, 0.19, 4.2e9, 3.1e9, 14e9, 1.7e8)
    _ttm("NWND", 29.1, 3.46, 1.9, 49.6e9, 5.06, 19.3, 48.45e9)
    _write("stock-peers", "NWND", [
        {"symbol": "ORBT", "companyName": "Orbital Data (Synthetic)", "price": 88.1, "mktCap": 61e9},
        {"symbol": "CRST", "companyName": "Crestline Cloud", "price": 41.2, "mktCap": 22e9},
        {"symbol": "LMNA", "companyName": "Lumina Analytics", "price": 210.0, "mktCap": 95e9},
        {"symbol": "KSTR", "companyName": "Kestrel AI", "price": 12.4, "mktCap": 6.1e9},
        {"symbol": "PYLN", "companyName": "Pylon Networks", "price": 57.0, "mktCap": 18e9},
        {"symbol": "TINY", "companyName": "Tiny Micro", "price": 1.1, "mktCap": 9e7},
        {"symbol": "NWND", "companyName": "Northwind (self echo)", "price": 142.5, "mktCap": 48e9},
    ])
    peers = {
        "ORBT": ("Orbital Data (Synthetic)", 88.1, 61e9, 31.5, 5.2, 21.0, 6.1),
        "CRST": ("Crestline Cloud Infrastructure & Distributed Ledger Holdings (Synthetic)",
                 41.2, 22e9, 24.0, 2.9, 15.8, 3.9),
        "LMNA": ("Lumina Analytics (Synthetic)", 210.0, 95e9, 36.2, 7.4, 25.5, 8.8),
        "KSTR": ("Kestrel AI (Synthetic)", 12.4, 6.1e9, -18.0, 4.0, 40.0, 9.5),
        "PYLN": ("Pylon Networks (Synthetic)", 57.0, 18e9, 19.4, 2.2, None, 2.7),
    }
    for sym, (name, price, mcap, pe, pb, ev_ebitda, ev_sales) in peers.items():
        _write("profile", sym, _profile(sym, name, "Technology", "Software - Infrastructure",
                                        price, mcap, 1.1, f"Fictional peer {sym}."))
        _ttm(sym, pe, pb, 1.5, mcap * 1.03, ev_sales, ev_ebitda, mcap)
    # PYLN lacks TTM EV/EBITDA → exercises the statement fallback path.
    _statements("PYLN", [6.6e9, 6.1e9, 5.7e9, 5.2e9, 4.9e9], 0.18, 0.14,
                0.05, 0.04, 0.01, 0.2, 2.0e9, 1.4e9, 8e9, 9e7)

    # --- HRBR: dividend-paying bank (DDM path) ---------------------------
    _write("profile", "HRBR", _profile(
        "HRBR", "Harbor Bancorp (Synthetic)", "Financial Services", "Banks - Regional",
        58.20, 23_280_000_000, 0.95,
        "Fictional regional bank used as a deterministic DDM fixture.", exchange="NYSE",
    ))
    _statements("HRBR", [11.2e9, 10.8e9, 10.1e9, 9.7e9, 9.2e9], 0.34, 0.24,
                0.02, 0.015, 0.0, 0.21, 31e9, 18e9, 26e9, 2.1e9,
                dividends=[1.08e9, 1.02e9, 0.96e9, 0.92e9, 0.88e9])
    _ttm("HRBR", 9.1, 0.9, 1.2, 36e9, 3.2, 7.4, 23.28e9)
    _write("stock-peers", "HRBR", [
        {"symbol": "TIDE", "companyName": "Tidewater Financial", "price": 33.0, "mktCap": 15e9},
        {"symbol": "ANCR", "companyName": "Anchor Trust", "price": 71.0, "mktCap": 30e9},
    ])
    for sym, name, price, mcap, pe, pb in (
        ("TIDE", "Tidewater Financial (Synthetic)", 33.0, 15e9, 8.4, 0.85),
        ("ANCR", "Anchor Trust (Synthetic)", 71.0, 30e9, 11.2, 1.25),
    ):
        _write("profile", sym, _profile(sym, name, "Financial Services", "Banks - Regional",
                                        price, mcap, 1.0, f"Fictional peer {sym}.", exchange="NYSE"))
        _ttm(sym, pe, pb, 1.1, mcap * 1.5, 3.0, 7.0, mcap)

    # --- LOSS: unprofitable company (negative EBIT, negative earnings) ---
    _write("profile", "LOSS", _profile(
        "LOSS", "Ember Robotics (Synthetic)", "Industrials", "Specialty Industrial Machinery",
        9.75, 2_925_000_000, 1.8, "Fictional loss-making robotics company.",
    ))
    _statements("LOSS", [1.1e9, 0.82e9, 0.6e9, 0.41e9, 0.3e9], -0.12, -0.15,
                0.06, 0.09, 0.03, 0.0, 0.9e9, 0.6e9, 1.2e9, 5e7, ebitda_missing=True)
    _ttm("LOSS", -19.5, 2.4, None, 3.2e9, 2.9, -22.0, 2.925e9)

    # --- ZERO: pre-revenue company → DCF cannot run ----------------------
    _write("profile", "ZERO", _profile(
        "ZERO", "Seedline Bio (Synthetic)", "Healthcare", "Biotechnology",
        4.10, 410_000_000, 1.4, "Fictional pre-revenue biotech.",
    ))
    _statements("ZERO", [0, 0, 0, 0, 0], 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                0.05e9, 0.3e9, 0.35e9, 2e6)
    _ttm("ZERO", None, 1.2, None, 0.16e9, None, None, 0.41e9)

    # --- THIN: profile only, every statement missing ---------------------
    _write("profile", "THIN", _profile(
        "THIN", "Sparse Data Corp (Synthetic)", "Consumer Cyclical", "Specialty Retail",
        22.0, 1_100_000_000, None, "",
    ))

    # --- Failure simulations ---------------------------------------------
    _write("profile", "RATE", {"__status__": 429, "body": {"message": "Limit Reach"}})
    _write("profile", "PREM", {"__status__": 402, "body": {
        "message": "Premium Query Parameter: this ticker requires a premium subscription"}})
    _write("profile", "DOWN", {"__status__": 503, "body": {"message": "maintenance"}})


if __name__ == "__main__":
    build()
    print(f"Fixtures written to {ROOT}")
