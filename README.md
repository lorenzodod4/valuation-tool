# Valuation.io

> Self-serve equity valuation toolkit. Type any US-listed ticker, get DCF, comparables, sensitivity, and a downloadable pitch book — in seconds.

**Live:** [valuation-tool-omega.vercel.app](https://valuation-tool-omega.vercel.app)

---

## What it does

Enter any US-listed ticker. The tool fetches financial data from Financial Modeling Prep and runs a complete valuation workflow:

- **Discounted Cash Flow (DCF)** — 5-year FCFF projection with auto-derived assumptions, real WACC computed per ticker using Damodaran-sourced Rf and ERP, terminal value via Gordon Growth.
- **Dividend Discount Model (DDM)** — For financial institutions and REITs, the tool automatically uses DDM instead of DCF. Projects 5 years of dividends with Gordon Growth terminal value and CAPM cost of equity.
- **Reverse DCF** — Solves for the implied revenue growth rate that justifies the current market price.
- **Trading Comparables** — peer group sourced dynamically and size-filtered; P/E, EV/EBITDA, EV/Sales, P/Book multiples.
- **Football Field** — unified view of valuation methods vs current market price.
- **Historical Financials** — 5-year trend of revenue, EBITDA, and net income.
- **DCF Sensitivity** — 5×5 grid of per-share value across WACC and terminal growth assumptions, color-coded against current price.
- **Sector Awareness** — Automatically selects DDM for Financial Services and Real Estate sectors; DCF for all other sectors.
- **PDF Export** — download a pitch book report with all key valuation outputs.

## Tech stack

**Frontend** — Next.js 16, TypeScript, Tailwind CSS v4, Recharts, @react-pdf/renderer. Deployed on Vercel.

**Backend** — FastAPI, Python 3.12, httpx, SQLite for persistent caching. Deployed on Render.

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
- ✓ Automatic DDM for Financial Services and Real Estate sectors
- ✓ Reverse DCF for growth-rate analysis
- ✗ Non-US listings (premium tier required)
- ✗ Real-time prices (15-minute delay)

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
python3.12 -m venv venv
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

Verification:
```bash
cd frontend
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run build         # Full production build
cd ../backend
python -m compileall app    # Python syntax check
```

## Limitations & honest notes

- Auto-derived assumptions are starting points, not conclusions. Real analysis requires user judgment on growth, margins, and discount rates.
- Free tier FMP coverage is limited to most US large/mid caps. Some smaller or recent tickers may have incomplete data.
- DCF is not the standard methodology for banks, REITs, and insurance companies. A warning is displayed for these sectors, and DDM is automatically used as the primary model.
- This is an educational project. Outputs are not investment advice.

## Roadmap

- ✅ DDM (Dividend Discount Model) for financial institutions
- ✅ Reverse DCF — implied growth rate solver
- 🟡 Multi-scenario DCF — component built, not yet integrated into report
- 🟡 Watchlist with localStorage — hook built, not yet surfaced in UI
- 🔜 European equity coverage (alternative data provider)
- 🔜 Real-time price integration

✅ = Shipped  🟡 = Prototype built  🔜 = Planned

## Author

Built by Lorenzo Dodero, an ESCP student.

*The mechanical parts of a valuation shouldn't take longer than the thinking behind them.*

[LinkedIn](https://www.linkedin.com/in/lorenzo-dodero/)

## License

© 2026 Lorenzo Dodero. All rights reserved.

This project is published for portfolio and educational purposes. No commercial use, redistribution, or derivative works are permitted without explicit written permission from the author. Feel free to study the code and learn from it. For inquiries about reuse or collaboration, contact me via LinkedIn.
