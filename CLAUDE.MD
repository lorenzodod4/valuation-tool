# Valuation Tool — Project Context

## Goal
Web app for instant company valuation. Users input a US-listed ticker, get DCF analysis, trading multiples vs peers, and football field visualization. Modern iOS-style design.

## Tech Stack
- **Backend**: Python 3.12, FastAPI, requests, yfinance, python-dotenv
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Data**: Financial Modeling Prep API (primary), yfinance (fallback)
- **Hosting**: Vercel (frontend), Railway (backend)

## Scope V1 (current focus)
- US large/mid cap tickers only (NYSE, NASDAQ)
- 5-year DCF with terminal value
- Trading multiples vs peer group (P/E, EV/EBITDA, EV/Sales)
- Football field chart
- English language UI
- NO LLM/AI features in V1 (planned for V1.5)

## Project Structure
valuation-tool/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── services/
│   │   ├── models/
│   │   └── config.py
│   ├── requirements.txt
│   └── .env (gitignored)
└── frontend/
    ├── app/
    ├── components/
    ├── lib/
    └── package.json

## Coding Conventions
- Python: PEP 8, type hints everywhere, docstrings on public functions
- TypeScript: strict mode, explicit types on function signatures
- Naming: snake_case Python, camelCase TypeScript
- Errors: explicit handling, never silent fails
- Comments: explain "why" not "what"

## Design Principles
- Modular: each service/component does one thing
- Testable: pure functions where possible, side effects isolated
- Progressive: start simple, add complexity only when needed
- iOS-inspired UI: generous whitespace, clear hierarchy, subtle animations, system fonts

## Out of Scope V1
- User authentication
- Saved portfolios
- Historical valuation tracking
- LBO models, merger models, precedent transactions
- European/Asian markets
- Mobile native apps

## Key Decisions Made
- FMP free tier (250 calls/day) sufficient for development
- yfinance as fallback only (less reliable structure)
- Streamlit rejected in favor of Next.js for design quality
- LLM insights deferred to V1.5 to ship V1 faster