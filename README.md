# Valuation.io

> Self-serve equity valuation toolkit. Type any US-listed ticker, get DCF, comparables, sensitivity, and a downloadable pitch book — in seconds.

**Live:** [valuation-tool-omega.vercel.app](https://valuation-tool-omega.vercel.app)

---

## What it does

Enter any US-listed ticker. The tool fetches financial data from Financial Modeling Prep and runs a complete valuation workflow:

- **Discounted Cash Flow (DCF)** — 5-year FCFF projection with auto-derived assumptions, real WACC computed per ticker using Damodaran-sourced Rf and ERP, terminal value via Gordon Growth.
- **Trading Comparables** — peer group sourced dynamically and size-filtered; P/E, EV/EBITDA, EV/Sales, P/Book multiples.
- **Football Field** — unified view of valuation methods vs current market price.
- **Historical Financials** — 5-year trend of revenue, EBITDA, and net income.
- **DCF Sensitivity** — 5×5 grid of per-share value across WACC and terminal growth assumptions, color-coded against current price.
- **Sector Awareness** — DCF warning for financials and REITs (where DCF is not the standard methodology).
- **PDF Export** — download a 3-page pitch book report with all key valuation outputs.

## Tech stack

**Frontend** — Next.js 16, TypeScript, Tailwind CSS v4, Recharts, @react-pdf/renderer. Deployed on Vercel.

**Backend** — FastAPI, Python 3.13, httpx, SQLite for persistent caching. Deployed on Render.

**Data** — Financial Modeling Prep API with 3-key rotation for resilience.

## WACC methodology

Cost of equity via CAPM:
- Risk-free rate: 4.18% (US 10Y Treasury, Damodaran Jan 2026)
- Equity Risk Premium: 4.23% (Damodaran Implied ERP, Jan 2026)
- Beta: company-specific from FMP

Cost of debt: derived from interest expense / total debt, falls back to 4.5% if unavailable.

Tax rate: from latest income statement, clamped [0%, 35%].

WACC = (E/V)×Re + (D/V)×Rd×(1-t).

All inputs cited and shown transparently in the UI.

## Coverage

- ✓ US-listed equities (NYSE, NASDAQ)
- ✗ Non-US listings (premium tier required)
- ✗ Real-time prices (15-minute delay)

For banks, REITs, insurance, and asset managers, the DCF output includes a warning: DDM (Dividend Discount Model) is the standard methodology for these sectors. The tool currently provides DCF as a reference only for these tickers; refer to Trading Comparables for primary analysis.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│  Next.js     │────▶│  FastAPI     │
│              │     │  (Vercel)    │     │  (Render)    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │  FMP API     │
                                          │  + SQLite    │
                                          │  cache       │
                                          └──────────────┘
```

## Local development

Backend:

```bash
cd backend
python3.13 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add at least FMP_API_KEY_1 to .env
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

## Limitations & honest notes

- Auto-derived DCF assumptions are starting points, not conclusions. Real analysis requires user judgment on growth, margins, and discount rates.
- Free tier FMP coverage is limited to most US large/mid caps. Some smaller or recent tickers may have incomplete data.
- DCF is not the standard methodology for banks, REITs, and insurance companies. A warning is displayed for these sectors; DDM implementation is planned.
- This is an educational project. Outputs are not investment advice.

## Roadmap

- DDM (Dividend Discount Model) for financial institutions
- Multi-scenario DCF with user-adjustable sliders
- Watchlist with localStorage persistence
- European equity coverage (alternative data provider)
- Real-time price integration

## Author

Built by Lorenzo Dodero, an ESCP student.

*The mechanical parts of a valuation shouldn't take longer than the thinking behind them.*

[LinkedIn](https://www.linkedin.com/in/lorenzo-dodero/)

## License

MIT
