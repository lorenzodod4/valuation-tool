"""Fetches financial data using yfinance (Yahoo Finance unofficial API)."""

import yfinance as yf
import pandas as pd
from typing import Optional


class FinancialDataFetcher:
    """Fetches financial data from Yahoo Finance via yfinance library."""

    def __init__(self):
        # No API key needed for yfinance
        pass

    def get_company_profile(self, ticker: str) -> dict:
        """Get basic company info: name, sector, industry, market cap, price."""
        stock = yf.Ticker(ticker)
        info = stock.info

        profile = {
            "symbol": info.get("symbol") if info else None,
            "name": (info.get("longName") or info.get("shortName")) if info else None,
            "sector": info.get("sector") if info else None,
            "industry": info.get("industry") if info else None,
            "country": info.get("country") if info else None,
            "market_cap": info.get("marketCap") if info else None,
            "price": (info.get("currentPrice") or info.get("regularMarketPrice")) if info else None,
            "currency": info.get("currency") if info else None,
            "pe_ratio": info.get("trailingPE") if info else None,
            "forward_pe": info.get("forwardPE") if info else None,
            "shares_outstanding": info.get("sharesOutstanding") if info else None,
            "beta": info.get("beta") if info else None,
            "description": info.get("longBusinessSummary") if info else None,
        }

        # yfinance echoes the requested symbol back even for nonexistent tickers, so the
        # "symbol" key alone isn't proof of a real listing — require at least one essential field.
        if not info or all(
            profile[field] is None for field in ("name", "market_cap", "price")
        ):
            raise ValueError(
                f"Ticker '{ticker}' not found or has no data on Yahoo Finance"
            )

        return profile

    def get_income_statement(self, ticker: str, years: int = 5) -> list:
        """Get last N years of income statements (annual)."""
        stock = yf.Ticker(ticker)
        df = stock.financials  # annual income statement

        if df.empty:
            raise ValueError(f"No income statement data for {ticker}")

        return self._dataframe_to_records(df, limit=years)

    def get_balance_sheet(self, ticker: str, years: int = 5) -> list:
        """Get last N years of balance sheets (annual)."""
        stock = yf.Ticker(ticker)
        df = stock.balance_sheet

        if df.empty:
            raise ValueError(f"No balance sheet data for {ticker}")

        return self._dataframe_to_records(df, limit=years)

    def get_cash_flow(self, ticker: str, years: int = 5) -> list:
        """Get last N years of cash flow statements (annual)."""
        stock = yf.Ticker(ticker)
        df = stock.cashflow

        if df.empty:
            raise ValueError(f"No cash flow data for {ticker}")

        return self._dataframe_to_records(df, limit=years)

    def get_all_financials(self, ticker: str, years: int = 5) -> dict:
        """Convenience method: fetch profile + 3 financial statements."""
        return {
            "profile": self.get_company_profile(ticker),
            "income_statement": self.get_income_statement(ticker, years),
            "balance_sheet": self.get_balance_sheet(ticker, years),
            "cash_flow": self.get_cash_flow(ticker, years),
        }

    def _dataframe_to_records(self, df: pd.DataFrame, limit: int = 5) -> list:
        """Convert yfinance DataFrame (rows=metrics, cols=dates) to list of dicts (one per year)."""
        # yfinance returns columns as Timestamps (most recent first)
        # We transpose so each row = one year, then convert to records
        df_transposed = df.T.head(limit)

        records = []
        for date, row in df_transposed.iterrows():
            record = {"date": date.strftime("%Y-%m-%d")}
            for metric, value in row.items():
                # Convert NaN to None, ensure values are JSON-serializable
                if pd.isna(value):
                    record[metric] = None
                else:
                    record[metric] = float(value)
            records.append(record)

        return records


if __name__ == "__main__":
    fetcher = FinancialDataFetcher()

    print("Fetching AAPL data...")
    data = fetcher.get_all_financials("AAPL", years=5)

    profile = data["profile"]
    print(f"\nCompany: {profile['name']}")
    print(f"Symbol: {profile['symbol']}")
    print(f"Sector: {profile['sector']}")
    print(f"Industry: {profile['industry']}")
    if profile['market_cap']:
        print(f"Market Cap: ${profile['market_cap']:,.0f}")
    if profile['price']:
        print(f"Current Price: ${profile['price']:.2f}")
    print(f"P/E Ratio: {profile['pe_ratio']}")

    print(f"\nIncome statements: {len(data['income_statement'])} years")
    if data['income_statement']:
        latest = data['income_statement'][0]
        print(f"Latest period: {latest['date']}")
        # yfinance uses different metric names, let's just show what we have
        if 'Total Revenue' in latest:
            print(f"Latest Total Revenue: ${latest['Total Revenue']:,.0f}")
        if 'Net Income' in latest:
            print(f"Latest Net Income: ${latest['Net Income']:,.0f}")