# Valuation.io

> Self-serve equity valuation toolkit. Type any US-listed ticker, get DCF, comparable multiples, and a football-field summary — in seconds.

**Live demo:** [valuation-tool-omega.vercel.app](https://valuation-tool-omega.vercel.app)

---

## What it does

Enter any ticker (e.g., AAPL, NVDA, JPM). The tool fetches financial statements from Financial Modeling Prep and runs three valuation methods in parallel:

- **Discounted Cash Flow (DCF)** — 5-year projection with auto-derived assumptions (revenue growth from historical CAGR, EBIT margin from 3-year average, working capital cycle from history), terminal value via Gordon Growth, 9% WACC default.
- **Trading Comparables** — peer group sourced dynamically from FMP, filtered by market cap. Multiples computed: P/E, EV/EBITDA, EV/Sales, P/Book. Implied valuations via peer median multiples.
- **Football Field** — unified view of all methods plotted against current market price.

Everything assumes neutral starting points. The auto-derived assumptions are conversation starters, not conclusions.

## Tech stack

**Frontend** — Next.js 16, TypeScript, Tailwind CSS v4, Recharts. Deployed on Vercel.

**Backend** — FastAPI, Python 3.13, httpx, cachetools. Deployed on Render.

**Data** — Financial Modeling Prep API (free tier, 250 calls/day). 1-hour in-memory cache reduces actual API consumption.

## Coverage

- ✓ US-listed equities (NYSE, NASDAQ)
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
                                          │  (data)      │
                                          └──────────────┘
```

Frontend renders the UI. Backend orchestrates 5–6 FMP calls per ticker (profile, income, balance, cash flow, key metrics, peers), computes the valuation logic, returns structured JSON. Cache layer absorbs repeat hits.

## Local development

Requires Python 3.13 and Node 20+.

### Backend

```bash
cd backend
python3.13 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env to add your FMP_API_KEY (free at https://site.financialmodelingprep.com)
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Open `localhost:3000`.

## Project structure

```
valuation-tool/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI routes
│   │   ├── services/      # DCF, multiples, data fetcher
│   │   ├── models/        # Pydantic schemas
│   │   ├── config.py
│   │   └── main.py
│   ├── requirements.txt
│   └── render.yaml
└── frontend/
    ├── app/               # Next.js pages
    ├── components/        # React components
    ├── contexts/          # Theme provider
    ├── lib/               # API client, formatters
    └── types/             # TypeScript types
```

## Limitations & honest notes

- The auto-derived DCF assumptions are starting points. Real analysis requires user judgment on growth, margins, and discount rates.
- Peer groups come from FMP's algorithm + a market-cap quality filter. They're reasonable but not curated.
- Free tier covers most US large/mid caps; some smaller tickers may have incomplete financial data.
- Cold start on Render free tier: first request after 15 minutes of inactivity takes ~40 seconds while the backend wakes up.
- This is an educational project. Not investment advice.

## Author

Built by **Lorenzo Dodero**, an ESCP student.

I built this as a personal exercise — partly to sharpen my own modeling fundamentals, partly because I wanted a tool that could actually help in the day-to-day work I do as a finance student and intern. The mechanical parts of a valuation shouldn't take longer than the thinking behind them.

[LinkedIn](https://www.linkedin.com/in/lorenzo-dodero-b494b229b)

## License

MIT — feel free to fork, study, and adapt. If you build something interesting on top, I'd love to hear about it.
