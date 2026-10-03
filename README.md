# Valuation.io

> Self-serve equity valuation toolkit. Type any US-listed ticker, get DCF, comparables, sensitivity, and a downloadable pitch book — in seconds.

**Live:** [valuation-tool-omega.vercel.app](https://valuation-tool-omega.vercel.app)

---

## What it does

Enter any US-listed ticker. The tool fetches financial data from Financial Modeling Prep and runs a complete valuation workflow:

- **Discounted Cash Flow (DCF)** — 5-year FCFF projection with auto-derived assumptions, real WACC computed per ticker from the US 10Y Treasury yield and Damodaran's implied ERP, terminal value via Gordon Growth.
- **Dividend Discount Model (DDM)** — For financial institutions and REITs, the tool automatically uses DDM instead of DCF. Projects 5 years of dividends with Gordon Growth terminal value and CAPM cost of equity.
- **Reverse DCF** — Solves for the implied revenue growth rate that justifies the current market price.
- **Trading Comparables** — peer group sourced dynamically and size-filtered; P/E, EV/EBITDA, EV/Sales, P/Book multiples.
- **Football Field** — unified view of valuation methods vs current market price.
- **Historical Financials** — 5-year trend of revenue, EBITDA, and net income.
- **DCF Sensitivity** — 5×5 grid of per-share value across WACC and terminal growth assumptions, color-coded against current price.
- **Sector Awareness** — Automatically selects DDM for Financial Services and Real Estate sectors; DCF for all other sectors.
- **PDF Export** — download a pitch book report with all key valuation outputs.

## Tech stack

**Frontend** — Next.js 16, TypeScript, Tailwind CSS v4 (preflight) + token-based CSS, three.js (hero scene, lazy-loaded), @react-pdf/renderer. Charts are purpose-built SVG/CSS. Deployed on Vercel.

**Backend** — FastAPI, Python 3.12, httpx, SQLite cache. Deployed on Render.

**Data** — Financial Modeling Prep `/stable` API with multi-key rotation.

## Data budget

The FMP free tier allows a few hundred calls per day across all users, so every provider request goes through:

1. **SQLite cache** — quotes and trailing ratios for 1 hour, annual statements and peer lists for 24 hours.
2. **Single-flight coalescing** — the four requests a report page makes share one provider fetch per endpoint.
3. **Lean peers** — a peer costs 3 calls (profile + TTM ratios + TTM metrics); statements are fetched only if a ratio is missing.
4. **Bounded retries** — one retry on network/5xx, key rotation on 429, never a loop.
5. **Stale fallback** — if the provider is down, a recent cached copy is served and the report says so.
6. **Cold-ticker budget** — each IP may open 12 uncached tickers per hour (`COLD_TICKERS_PER_HOUR`); cached tickers are unlimited.

A first-time ticker costs about 25 calls (6 for the company, 1 peer list, ~3 per peer); repeat visits within the cache window cost none.

## WACC methodology

Cost of equity via CAPM with the US 10-year Treasury yield as the risk-free rate and Damodaran's implied equity risk premium (configured in `backend/app/config.py`, each dated in every report; the oldest input is flagged after six months), and company beta from FMP. Cost of debt is interest expense ÷ total debt, clamped to 1–15%, with a 4.5% fallback. Tax rate comes from the latest income statement, clamped to 0–35%.

WACC = (E/V)×Re + (D/V)×Rd×(1−t). See `/methodology` for every formula and default.

## Coverage

- ✓ US-listed equities (NYSE, NASDAQ)
- ✓ Automatic DDM for Financial Services and Real Estate sectors
- ✓ Reverse DCF for growth-rate analysis
- ✗ Non-US listings (premium tier required)
- ✗ Real-time prices (provider data may be delayed)

## Architecture

```
Browser ──▶ Next.js (Vercel) ──▶ FastAPI (Render) ──▶ FMP /stable
                                     │
                                     └── SQLite cache + single-flight
```

API keys live only on the backend. The browser never talks to FMP.

## Local development

Backend — offline, against deterministic fixtures (no key, no quota):
```bash
cd backend
python3.12 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
FMP_FIXTURE_DIR=tests/fixtures/fmp uvicorn app.main:app --reload --port 8000
```
Fixture tickers are fictional: `NWND` (software, DCF), `HRBR` (bank, DDM), `LOSS` (loss-making),
`ZERO` (pre-revenue), `THIN` (no statements), `NOPE` (unknown), `PREM`/`RATE`/`DOWN` (provider failures).
Regenerate them with `python -m tests.fixtures.build_fixtures`.

Backend — live data: copy `.env.example` to `.env` and set `FMP_API_KEY_1`.

Frontend:
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Verification:
```bash
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
cd ../backend && python -m pytest tests/ -q     # offline; never touches the network
```

`npm test` checks that the landing-page demo's TypeScript DCF matches the Python engine to 1e-12.

### Deploying the backend behind a proxy

No configuration needed on Render: the backend detects `RENDER=true` and reads the client IP 2 hops from the right of `X-Forwarded-For` (Cloudflare, then Render's proxy). Elsewhere, set `TRUSTED_PROXY_HOPS` to the number of proxies in front of the app.

## Limitations & honest notes

- Auto-derived assumptions are starting points, not conclusions. Real analysis requires user judgment on growth, margins, and discount rates.
- Free tier FMP coverage is limited to most US large/mid caps. Some smaller or recent tickers may have incomplete data.
- DCF is not the standard methodology for banks, REITs, and insurance companies. A warning is displayed for these sectors, and DDM is automatically used as the primary model.
- This is an educational project. Outputs are not investment advice.

## Roadmap

- ✅ DDM (Dividend Discount Model) for financial institutions
- ✅ Reverse DCF — implied growth rate solver
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
