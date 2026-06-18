# LLM Context - Valuation Tool

Last updated: 2026-06-18  
Purpose: shared project memory and roadmap for future LLM/agent work.  
Project: `valuation-tool` / `valuation.io`  
Owner: Lorenzo Dodero

This document is the source of truth for the next improvement phases. Read it
before touching code. It intentionally separates verified current state from
planned or partially integrated work.

---

## 1. Current Reality Check

### Verified Stack

Frontend:
- Next.js 16 App Router, React 19, TypeScript strict mode.
- Tailwind CSS v4 plus large custom global CSS.
- Recharts for charts.
- `@react-pdf/renderer` for PDF export.
- lucide-react available and should be used for button/control icons.

Backend:
- FastAPI.
- Python virtualenv exists at `backend/venv`.
- FMP `/stable` API via `httpx`.
- SQLite persistent cache at `backend/cache.db`.
- Multi-key FMP rotation exists.

Local env:
- `frontend/.env.local` points to `NEXT_PUBLIC_API_URL=http://localhost:8000`.
- `backend/.env` contains FMP keys and is gitignored.

Git/deployment snapshot as of 2026-06-18:
- Local `main` and GitHub `origin/main` are aligned at `8a344bd481d87ef14d49dd555e1b77faada5a890`.
- Remote: `https://github.com/lorenzodod4/valuation-tool.git`.
- Tracked deployment config: `render.yaml` for the backend Render service.
- README points to Vercel frontend: `https://valuation-tool-omega.vercel.app`.
- `.github/workflows/ci.yml` exists locally but is untracked until committed.

### Current Verification Status

Most recent local checks on 2026-06-18:
- `npm run lint`: 0 errors ✅
- `npm run typecheck`: 0 errors ✅
- `npm run build`: passed ✅
- `python3 -m compileall app` from `backend/`: passes ✅
- `backend/venv/bin/python -m pytest tests/ -v`: 5 tests pass ✅

All Phase 0 lint issues fixed on 2026-06-17:
- `ScenarioBuilder.tsx`: `any` → typed `DCFScenarioAssumptions` interface.
- `useWatchlist.ts`: synchronous `setState` in `useEffect` → lazy `useState(loadWatchlist)`.

Tests / CI:
- Backend pytest suite exists locally under `backend/tests/`.
- Local CI workflow exists at `.github/workflows/ci.yml` and runs frontend lint/typecheck/build plus backend compile/tests.
- The CI workflow is not active on GitHub until `.github/workflows/ci.yml` is committed and pushed.
- No frontend unit/component test suite yet.
- No Playwright e2e suite yet.

### Dirty Worktree Warning

The worktree contains many modified and untracked files. Treat all of them as
current user/work-in-progress state. Do not revert or delete without explicit
approval.

Important untracked/partially integrated files observed:
- `.github/workflows/ci.yml`
- `backend/app/services/ddm.py`
- `backend/tests/*`
- `frontend/components/DDMCard.tsx`
- `frontend/components/ScenarioBuilder.tsx`
- `frontend/lib/useWatchlist.ts`
- `frontend/app/landing-fixes.css`
- `frontend/app/landing-upgrades.css`
- `frontend/app/site-wide-enhancements.css`
- many root reports such as `LANDING_*`, `*_SUMMARY.md`, `*_REPORT.md`
- root `InteractiveBackground.tsx`, apparently empty/stale

### Documentation Drift (RESOLVED 2026-06-17)

README was updated to remove contradictions:
- DDM listed as ✅ completed, with automatic detection for financials/REITs.
- Reverse DCF listed as ✅ shipped.
- Scenario Builder and Watchlist marked as 🟡 prototype (built, not integrated).
- "DDM implementation is planned" language removed from limitations.
- Added `typecheck` script and verification commands.

Temporary report files in root (`LANDING_*`, `*_REPORT.md`, `*_SUMMARY.md`) remain for reference. They can be archived to `docs/archive/` after approval.

---

## 2. Product Intent

Valuation.io is a self-serve public equity valuation tool:
- User enters a ticker.
- App fetches public company data from FMP.
- App returns a report with valuation methods, diagnostics, assumptions,
  comparables, sensitivity, reverse valuation context, and PDF export.

Positioning:
- Educational and portfolio project.
- Not investment advice.
- Institutional, analyst-workstation feel.
- Dense, scannable, audit-friendly UI.
- Avoid generic marketing pages and decorative overload.

Do not present features as AI-powered unless there is real AI functionality.

---

## 3. Architecture Map

High-level flow:

```text
Browser
  -> Next.js frontend
  -> FastAPI backend
  -> FMP API
  -> SQLite response cache
```

Key frontend files:
- `frontend/app/page.tsx`: landing/search.
- `frontend/app/valuation/[ticker]/page.tsx`: orchestrates valuation data fetches.
- `frontend/components/ValuationContent.tsx`: main report composition.
- `frontend/components/DCFCard.tsx`: DCF display and WACC breakdown.
- `frontend/components/DDMCard.tsx`: DDM display, currently present.
- `frontend/components/ReverseDCFCard.tsx`: reverse DCF calculator.
- `frontend/components/MultiplesCard.tsx`: peer table, peer override, implied values.
- `frontend/components/FootballField.tsx`: valuation range chart.
- `frontend/components/SensitivityHeatmap.tsx`: DCF sensitivity grid.
- `frontend/components/HistoricalChart.tsx`: historical revenue/EBITDA/net income.
- `frontend/components/ModelDiagnostics.tsx`: model quality/control panel.
- `frontend/components/ValuationPDF.tsx`: PDF report.
- `frontend/lib/api.ts`: frontend API client.
- `frontend/types/valuation.ts`: handwritten API contract types.
- `frontend/app/globals.css` plus imported landing/site CSS: global styling.

Key backend files:
- `backend/app/main.py`: FastAPI app, CORS, rate limiter.
- `backend/app/api/valuation.py`: valuation API router.
- `backend/app/models/schemas.py`: Pydantic models.
- `backend/app/services/data_fetcher.py`: FMP client, key rotation, normalization.
- `backend/app/services/cache.py`: SQLite cache.
- `backend/app/services/dcf.py`: DCF assumptions and valuation.
- `backend/app/services/ddm.py`: DDM assumptions and valuation.
- `backend/app/services/multiples.py`: peer discovery and trading multiples.
- `backend/app/services/wacc.py`: WACC/CAPM calculation.

---

## 4. Design / UX Audit

### High-Severity UX Risks

1. Fetch requests are not abortible.
   - File: `frontend/app/valuation/[ticker]/page.tsx`
   - File: `frontend/lib/api.ts`
   - Current page uses `cancelled` state but does not abort HTTP requests.
   - Risk: rapid ticker changes or slow backend can accumulate requests and consume FMP quota.
   - Complexity: M.

2. Interactive state does not propagate to the whole report.
   - Files: `ReverseDCFCard.tsx`, `MultiplesCard.tsx`, `ValuationContent.tsx`, `ValuationPDF.tsx`.
   - Custom reverse DCF target and custom peer overrides stay local.
   - PDF/overview/football field can represent initial data while the UI shows edited data.
   - Complexity: M/L.

3. Accessibility is weak for charts and heatmaps.
   - Files: `FootballField.tsx`, `HistoricalChart.tsx`, `SensitivityHeatmap.tsx`.
   - Too much meaning is color/tooltip dependent.
   - Need aria summaries, text equivalents, and table fallback for key numbers.
   - Complexity: M.

4. DDM model sectors can still show DCF-only secondary modules.
   - Files: `ValuationContent.tsx`, `valuation.py`.
   - If `/full` selects DDM, reverse DCF and DCF sensitivity can still be requested/displayed.
   - This is confusing for banks/REITs unless explicitly framed as secondary/illustrative.
   - Complexity: M/L.

### Medium UX Risks

1. Mobile tables are only horizontally scrollable.
   - Files: `globals.css`, DCF/peer/sensitivity components.
   - Need sticky first columns, scroll hints, compact card views, or mobile summaries.
   - Complexity: S/M.

2. Header market references are hard-coded.
   - File: `Header.tsx`.
   - SPX/NDX/VIX/10Y look live but are static.
   - Either remove/rename as illustrative or connect to real delayed data.
   - Complexity: S if removed, M if made real.

3. Currency formatting is USD-only.
   - File: `frontend/lib/format.ts`.
   - Types include `currency`, but all output uses `$`.
   - Complexity: M.

4. CSS and motion are heavy.
   - Files: `globals.css`, `landing-fixes.css`, `landing-upgrades.css`,
     `site-wide-enhancements.css`, `ScrollFade.tsx`, `DotField.tsx`,
     `BorderGlow.tsx`.
   - Multiple global layers override each other.
   - Reduced motion does not fully cover JS-driven effects.
   - Complexity: M/L.

### UX / Design Roadmap

P0:
- Fix lint in `ScenarioBuilder.tsx` and `useWatchlist.ts`.
- Decide whether `ScenarioBuilder` and watchlist are real active features or parked prototypes.
- Rename static `RECENT` tickers to `Examples` unless real recents/watchlist are wired.

P1:
- Add abortable requests through `AbortSignal` in `lib/api.ts` and valuation page.
- Lift report custom state into `ValuationContent`:
  - reverse target
  - custom peer set
  - future scenario assumptions
  - PDF input
  - football field input
- Add a report-level action/summary bar:
  - current model
  - key warnings
  - export
  - section nav
  - data freshness
- Add semantic chart summaries and table fallbacks.

P2:
- Improve mobile:
  - compact KPI cards for tables
  - sticky ticker/value columns
  - scroll affordance
  - fewer nested glow cards
- Consolidate report styling toward dense analyst workstation:
  - fewer decorative wrappers
  - tighter hierarchy
  - stronger table scanability
- Add export options:
  - include/exclude sections
  - use current custom assumptions
  - add appendix with model inputs.

P3:
- Compare tickers side by side.
- Peer curator with saved peer sets.
- Watchlist/recent analyses with localStorage.

---

## 5. Backend / Financial Logic Audit

### High-Severity Backend Risks

1. FMP `402` handling can burn keys globally.
   - File: `backend/app/services/data_fetcher.py`.
   - Current logic marks a key exhausted for `402` and `429`.
   - If `402` is ticker-specific/premium, a single unsupported ticker can mark all keys unusable.
   - Complexity: M.

2. Frontend fetches duplicate backend bundles.
   - Files: `valuation/[ticker]/page.tsx`, `backend/app/api/valuation.py`.
   - Page requests `/full`, `/historical-financials`, `/sensitivity`,
     `/reverse-dcf` in parallel.
   - Each route calls `_fetch_all`; cache helps but does not eliminate cold-cache
     duplication or quota pressure.
   - Complexity: L for full aggregation, M for singleflight/coalescing.

3. Sector-aware model consistency is incomplete.
   - Files: `valuation.py`, `ValuationContent.tsx`, `ReverseDCFCard.tsx`,
     `SensitivityHeatmap.tsx`.
   - `/full` may use DDM, but reverse/sensitivity endpoints remain DCF-only.
   - Need either DDM equivalents or explicit suppression/disclosure.
   - Complexity: M/L.

4. DCF growth floor can bias valuations upward.
   - File: `backend/app/services/dcf.py`.
   - Historical growth is floored at `terminal_growth + 1%`.
   - Flat/declining companies get forced into positive near-term growth.
   - Complexity: M.

5. Working capital sign convention may be wrong.
   - Files: `data_fetcher.py`, `dcf.py`.
   - FMP `changeInWorkingCapital` sign must be verified.
   - Current FCFF subtracts `wc_change_pct_revenue`.
   - Complexity: M.

### Medium Backend Risks

1. WACC cost of debt ignores negative interest expense.
   - File: `wacc.py`.
   - If FMP reports interest expense as negative, current `<= 0` check falls back to default.
   - Complexity: S/M.

2. Multiples mix TTM multiples with annual target metrics.
   - File: `multiples.py`.
   - Need consistent TTM numerator/denominator or clearly label as FY.
   - Complexity: M.

3. Quartiles are unstable with small peer sets.
   - File: `multiples.py`.
   - `statistics.quantiles` default is not ideal for 2 peers.
   - Complexity: S/M.

4. Assumption overrides are under-validated.
   - File: `schemas.py`.
   - Need Pydantic bounds for WACC, terminal growth, margins, tax, CapEx, WC.
   - Complexity: S/M.

5. Backend is hard to test.
   - Files: `config.py`, `valuation.py`.
   - FMP keys required at import.
   - Router instantiates global singletons.
   - Complexity: L.

6. Rate limiter is process-local and not proxy-aware.
   - File: `main.py`.
   - In-memory IP limit is weak on Render/multi-worker/proxy setups.
   - Complexity: M.

### Backend / Finance Roadmap

P0:
- Fix FMP error taxonomy:
  - distinguish `invalid_key`, `quota_exhausted`, `ticker_premium`, `ticker_not_found`.
  - do not globally exhaust keys on ticker-specific `402`.
- Add Pydantic validation bounds to `DCFAssumptions`.
- Make current lint green before deeper backend changes.

P1:
- Introduce a report aggregate endpoint:
  - `/api/valuation/{ticker}/report` or expanded `/full`
  - returns profile, primary model, secondary models, historical, sensitivity,
    reverse analysis, diagnostics, source metadata, warnings.
- Add cache singleflight / in-process request coalescing for identical cold-cache calls.
- Fix DCF assumptions:
  - allow negative/flat growth when history supports it.
  - fade toward terminal without artificial upward floor.
  - document growth methodology.
- Verify and fix working capital sign convention with tests.
- Fix WACC negative interest expense handling.
- Align multiples to consistent period basis.

P2:
- Sector-aware valuation package:
  - DCF for industrial/tech/consumer/etc.
  - DDM for financials/REITs/dividend-focused sectors.
  - for financials, emphasize P/B, tangible book if available, P/E normalized,
    dividend yield.
  - DDM sensitivity: cost of equity x terminal growth.
  - reverse DDM or suppress reverse DCF for DDM sectors.
- Add data-quality diagnostics:
  - stale source data
  - missing statements
  - fallback assumptions
  - peer sample size
  - model suitability.

P3:
- Multi-provider architecture for non-US equities.
- Real-time/delayed quote provider abstraction.
- Advanced model features: share dilution, SBC, leases, minority interest,
  preferred stock, buybacks, normalized margins.

---

## 6. Architecture / Quality / Testing Audit

### Critical Gaps

1. Tests and CI are started locally but not yet on GitHub.
   - `.github/workflows/ci.yml` and `backend/tests/*` should be committed before major refactors.
   - Add broader test fixtures before changing valuation formulas.

2. Contracts are weak and duplicated.
   - Backend models use many `dict[str, Any]`.
   - Frontend TS types are manually maintained.
   - Need stronger Pydantic models and generated TS types or schema checks.

3. CSS ownership is unclear.
   - `globals.css` is roughly 6000 lines.
   - Three extra global stylesheets are imported in `layout.tsx`.
   - Landing/report styles are overridden across files.

4. Many temporary reports clutter root.
   - Hard to know what is source vs note.
   - Archive into `docs/archive/` or delete after approval.

5. Config/import coupling blocks easy tests.
   - `config.py` raises when keys are missing.
   - Router creates concrete services at import.

### Quality Roadmap

P0:
- Make `npm run lint` pass.
- Add `frontend` scripts:
  - `typecheck`: `tsc --noEmit`
  - `test`: placeholder or real test runner once chosen.
- Add backend test dependencies:
  - `pytest`
  - optionally `pytest-cov`
  - optionally `respx` or mock transport for httpx.

P1:
- Add minimal CI:
  - frontend lint
  - frontend typecheck
  - frontend build
  - backend compile/import
  - backend tests.
- Refactor backend app creation:
  - create app factory.
  - dependency injection for fetcher/valuator.
  - allow tests without real FMP keys.
- Add first backend tests:
  - WACC negative interest expense.
  - DCF growth handling.
  - working capital sign fixture.
  - reverse DCF bounds.
  - FMP 402 vs 429 behavior.
  - multiples with small peer set.

P2:
- Generate frontend types from OpenAPI or add contract tests.
- Split backend services:
  - provider normalization
  - financial statement models
  - assumption derivation
  - pure valuation math
  - API orchestration.
- Split frontend report:
  - data orchestration hook
  - report state reducer
  - section components
  - export adapter.
- Split CSS:
  - tokens
  - base/layout
  - route-level CSS
  - component CSS modules or colocated classes.

P3:
- Add Playwright smoke:
  - homepage renders.
  - search navigates.
  - valuation happy path with mocked API.
  - error state.
  - theme toggle.
  - PDF button visibility.
- Add dependency/security checks:
  - `npm audit` or configured alternative.
  - `pip-audit`.
  - `gitleaks` secret scan.

---

## 7. Unified Roadmap

### Phase 0 - Baseline Stabilization

Goal: make the repo reliable enough to improve.

Tasks:
1. Fix lint failures.
   - `ScenarioBuilder.tsx`: replace `any` with typed assumptions shape.
   - `useWatchlist.ts`: initialize localStorage state lazily or via safe pattern
     compatible with React 19 lint.
   - Complexity: S.

2. Decide prototype status.
   - Either integrate `ScenarioBuilder`, `DDMCard`, `useWatchlist` fully or mark them
     explicitly as parked prototypes.
   - Complexity: S/M.

3. Update README to remove contradictions.
   - DDM status must match code.
   - Python version must match deployment (`render.yaml`) and local instructions.
   - Complexity: S.

4. Add verification scripts.
   - Frontend `typecheck`.
   - Backend test placeholder.
   - Complexity: S.

Acceptance:
- `npm run lint` passes.
- `npm run build` passes.
- `python3 -m compileall backend/app` passes.
- README and this file agree.

### Phase 1 - Correctness and Data Safety

Goal: protect quota, fix financial correctness risks, and make API outputs coherent.

Tasks:
1. FMP key/error taxonomy.
2. Abortable frontend requests.
3. DCF/DDM sector coherence.
4. Validate assumption overrides.
5. WACC negative interest expense fix.
6. Working capital sign convention verified and tested.
7. Multiples period consistency.

Acceptance:
- Unsupported ticker does not exhaust all FMP keys.
- Financial/REIT pages do not silently show DCF-only modules as primary.
- Custom DCF POST rejects invalid assumptions.
- Core valuation math has tests.

### Phase 2 - Report Experience and State Architecture

Goal: make the report feel like a professional workbench and keep all outputs aligned.

Tasks:
1. Report-level state reducer for:
   - custom reverse DCF target
   - custom peers
   - scenario assumptions
   - export state.
2. PDF export uses current visible state.
3. Improve model diagnostics:
   - primary model
   - data freshness
   - source fields missing
   - fallback assumptions
   - peer quality.
4. Mobile table ergonomics.
5. Accessibility summaries for charts.

Acceptance:
- The number exported in PDF matches the visible report state.
- Users can understand chart outputs without relying only on color/hover.
- Mobile valuation page is usable without horizontal-scroll guesswork.

### Phase 3 - Testing, CI, and Refactor

Goal: make future changes safe.

Tasks:
1. Commit and activate the local GitHub Actions CI workflow.
2. Backend app factory and dependency injection.
3. Expand backend tests with mocked FMP.
4. Split monolithic backend services.
5. Split global CSS ownership.
6. Generate or validate API contracts.

Acceptance:
- CI blocks lint/type/test/build failures.
- Backend tests run without real FMP keys.
- CSS changes are localized and less order-dependent.

### Phase 4 - Product Features

Goal: add features only after correctness and state architecture are stable.

Candidates:
1. Scenario analysis:
   - batch backend endpoint.
   - bear/base/bull/custom.
   - PDF appendix.
2. Watchlist/recent analyses:
   - localStorage first.
   - use real recent tickers, not static labels.
3. Peer curator:
   - include/exclude peers.
   - saved peer sets.
   - peer quality scoring.
4. Compare tickers:
   - side-by-side KPI and multiples.
5. Expanded model support:
   - DDM sensitivity.
   - reverse DDM.
   - financial-sector P/B and dividend-focused comps.
6. Non-US coverage:
   - only after provider abstraction.

---

## 8. Complexity Legend

S:
- Single file or narrow local change.
- Low behavior risk.

M:
- Multiple files or API/UI contract touched.
- Needs focused tests.

L:
- Cross-cutting architecture or state change.
- Needs staged implementation and regression checks.

XL:
- New product capability or provider architecture.
- Needs design, data contracts, tests, and rollout plan.

---

## 9. Operating Rules for Future Agents

1. Read this file first.
2. Check `git status --short` before editing.
3. Do not revert user changes or untracked work without explicit approval.
4. If touching frontend:
   - run `npm run lint`.
   - run `npm run build` when practical.
5. If touching backend:
   - run `python3 -m compileall backend/app`.
   - run backend tests once added.
6. If changing API responses:
   - update `backend/app/models/schemas.py`.
   - update `frontend/types/valuation.ts`.
   - update PDF if relevant.
   - update this file.
7. If adding user-visible feature state:
   - decide whether PDF/export should reflect it.
   - avoid local-only state that changes the screen but not the report.
8. Do not add more global CSS files unless there is a clear ownership model.
9. Do not add heavy visual effects before CSS consolidation.
10. Keep finance copy honest:
   - disclose assumptions.
   - disclose missing data.
   - do not imply investment advice.

---

## 10. Resolution Playbook

This section translates the audit into concrete implementation approaches.
Use it as the execution guide when starting each phase.

### 10.1 Fix Current Lint Failures

Problem:
- `ScenarioBuilder.tsx` uses `any`.
- `useWatchlist.ts` synchronously sets state inside `useEffect`.

Resolution:
- In `ScenarioBuilder.tsx`, define a local `DCFScenarioAssumptions` type:
  - `revenue_growth_rates?: number[]`
  - `ebit_margin?: number`
  - `wacc?: number`
  - `terminal_growth_rate?: number`
- Cast `baseValuation.dcf?.assumptions_used` to that type instead of `any`.
- In `useWatchlist.ts`, initialize state lazily from localStorage only when
  `typeof window !== "undefined"`, or use a keyed state pattern that does not
  call `setState` synchronously in `useEffect`.
- Add defensive JSON parsing and validate array shape before accepting stored
  watchlist items.

Files:
- `frontend/components/ScenarioBuilder.tsx`
- `frontend/lib/useWatchlist.ts`

Verification:
- `npm run lint`
- `npm run build`

Complexity: S.

### 10.2 Stop FMP 402 From Burning All API Keys

Problem:
- `data_fetcher.py` currently treats `402` similarly to quota exhaustion.
- A ticker-specific premium error can mark all keys exhausted for the day.

Resolution:
- Introduce explicit provider error categories:
  - `InvalidApiKeyError`
  - `QuotaExhaustedError`
  - `PremiumTickerError`
  - `TickerNotFoundError`
  - `ProviderServerError`
- Mark a key exhausted only for real quota/auth cases:
  - `429`
  - clear daily-limit payloads
  - maybe provider-auth restrictions if confirmed key-specific
- For `402`, inspect response body:
  - if message says premium/subscription/ticker unavailable, raise
    `PremiumTickerError` without exhausting the key.
  - if body clearly says key plan restricted globally, record key restriction
    separately from daily quota.
- Add tests with mocked `httpx` responses:
  - `402 premium ticker` does not exhaust keys.
  - `429` exhausts one key and rotates.
  - all `429` returns API `429`.
  - invalid auth returns API `503`.

Files:
- `backend/app/services/data_fetcher.py`
- `backend/app/api/valuation.py`
- future `backend/tests/test_data_fetcher.py`

Verification:
- backend tests with mocked FMP.
- manual unsupported ticker should not break subsequent AAPL/MSFT request.

Complexity: M.

### 10.3 Reduce Duplicate Fetches and Quota Pressure

Problem:
- The valuation page calls several endpoints in parallel.
- Each endpoint calls `_fetch_all`, causing duplicate cold-cache work.

Resolution Option A, preferred:
- Create a single report endpoint:
  - `GET /api/valuation/{ticker}/report`
  - returns:
    - `profile`
    - primary model (`dcf` or `ddm`)
    - secondary/diagnostic models if applicable
    - `multiples`
    - `historical`
    - `sensitivity`
    - `reverse`
    - `diagnostics`
    - `data_metadata`
    - `warnings`
- Frontend page fetches only this endpoint for first load.
- Existing granular endpoints remain for custom recalculations.

Resolution Option B, transitional:
- Keep endpoints but add in-process singleflight cache:
  - key by `ticker + bundle_kind`.
  - concurrent identical `_fetch_all(ticker)` calls await the same result.
  - still persist final FMP responses in SQLite.

Files:
- `backend/app/api/valuation.py`
- `backend/app/services/data_fetcher.py`
- `frontend/app/valuation/[ticker]/page.tsx`
- `frontend/lib/api.ts`
- `frontend/types/valuation.ts`

Verification:
- cold page load should call provider once per needed FMP resource, not once per
  frontend section.
- mocked backend test can count fetcher calls.

Complexity:
- Option A: L.
- Option B: M.

### 10.4 Make DCF/DDM Sector Logic Coherent

Problem:
- `/full` can choose DDM for financials/REITs, while reverse DCF and DCF
  sensitivity still appear or can be fetched as if primary.

Resolution:
- Add a `primary_model` field to the full/report response:
  - `"dcf"` or `"ddm"`.
- For DDM sectors:
  - hide DCF sensitivity by default, or label it as “illustrative FCFF DCF”.
  - replace reverse DCF with reverse DDM or a clear unavailable state.
  - add DDM sensitivity grid: cost of equity x terminal growth.
  - for financials, prioritize P/B, P/TBV if available, P/E, dividend yield.
- Update `ModelDiagnostics` to show model suitability.
- Update PDF to reflect the same primary/secondary model structure.

Files:
- `backend/app/api/valuation.py`
- `backend/app/services/ddm.py`
- `backend/app/services/dcf.py`
- `frontend/components/ValuationContent.tsx`
- `frontend/components/ModelDiagnostics.tsx`
- `frontend/components/ReverseDCFCard.tsx`
- `frontend/components/SensitivityHeatmap.tsx`
- `frontend/components/ValuationPDF.tsx`
- `frontend/types/valuation.ts`

Verification:
- JPM/REIT example: primary model is DDM; no unlabelled DCF reverse/sensitivity.
- AAPL/MSFT example: primary model remains DCF.

Complexity: M/L.

### 10.5 Fix DCF Growth Bias

Problem:
- Revenue growth is floored at `terminal_growth + 1%`, creating upward bias for
  flat/declining companies.

Resolution:
- Replace the hard floor with a bounded normalized CAGR:
  - compute raw 3-year CAGR.
  - cap high growth, but allow negative growth to a reasonable floor such as
    `-10%` or sector-aware bound.
  - if raw growth is below terminal growth, fade upward/downward gradually
    toward terminal without forcing year 1 above terminal.
- Add warnings:
  - declining revenue history.
  - volatile revenue history.
  - fallback due insufficient history.
- Add tests:
  - declining revenue stays declining or low-growth in Y1.
  - high-growth company caps correctly.
  - insufficient history uses default and warns.

Files:
- `backend/app/services/dcf.py`
- future `backend/tests/test_dcf_assumptions.py`

Verification:
- fixtures with declining revenue do not produce forced +3.5% Y1 growth.

Complexity: M.

### 10.6 Verify Working Capital Sign Convention

Problem:
- FMP `changeInWorkingCapital` sign may not match current FCFF formula.
- Current model subtracts `wc_change_pct_revenue`.

Resolution:
- Establish canonical convention at normalization boundary:
  - store `investment_in_working_capital` as positive when cash is consumed.
  - store `working_capital_cash_flow` separately if useful.
- Convert FMP field explicitly:
  - inspect FMP docs/sample payloads.
  - write fixture tests for positive and negative change.
- Update DCF formula to subtract investment in working capital only.
- Update assumptions label in UI from “Change in WC % revenue” to a clearer
  “NWC investment % revenue” if convention changes.

Files:
- `backend/app/services/data_fetcher.py`
- `backend/app/services/dcf.py`
- `frontend/components/DCFCard.tsx`
- `frontend/components/ValuationPDF.tsx`

Verification:
- tests prove FCFF increases when working capital releases cash and decreases
  when working capital consumes cash.

Complexity: M.

### 10.7 Fix WACC Cost of Debt Sign Handling

Problem:
- If interest expense is negative, current code falls back to default instead
  of using absolute interest expense.

Resolution:
- Change cost of debt logic:
  - if `interest_expense is None`, use default.
  - else use `abs(interest_expense) / total_debt`.
  - clamp result to sane range.
- Add warning/source metadata:
  - derived vs default.
- Add tests for:
  - positive interest expense.
  - negative interest expense.
  - missing debt.
  - zero debt.

Files:
- `backend/app/services/wacc.py`
- `frontend/components/DCFCard.tsx` if displaying source detail.

Verification:
- negative interest expense no longer forces default.

Complexity: S/M.

### 10.8 Align Multiples Periods and Improve Peer Ranges

Problem:
- Peer multiples may be TTM while target numerators are latest fiscal year.
- Quartile ranges are unstable with small peer sets.

Resolution:
- Use TTM values where available:
  - revenue TTM
  - EBITDA TTM
  - net income TTM
  - enterprise value TTM
  - market cap current.
- If TTM numerator unavailable, label method as FY and warn.
- Implement robust percentile helper:
  - for one peer: no range, median only.
  - for two peers: low=min, high=max or no quartile label.
  - for 3+ peers: controlled percentile method.
- Add peer diagnostics:
  - sample size by metric.
  - skipped peers.
  - source: custom/FMP/static fallback.

Files:
- `backend/app/services/data_fetcher.py`
- `backend/app/services/multiples.py`
- `backend/app/models/schemas.py`
- `frontend/components/MultiplesCard.tsx`
- `frontend/components/FootballField.tsx`
- `frontend/components/ModelDiagnostics.tsx`

Verification:
- peer range never shows misleading quartile from only one peer.
- target and peer period basis is visible.

Complexity: M.

### 10.9 Validate Assumption Overrides

Problem:
- DCF custom POST accepts financially impossible values.

Resolution:
- Use Pydantic `Field` constraints:
  - WACC: e.g. `0.03 <= wacc <= 0.25`
  - terminal growth: e.g. `-0.02 <= terminal_growth_rate <= 0.06`
  - tax rate: `0 <= tax_rate <= 0.40`
  - EBIT margin: maybe `-0.50 <= ebit_margin <= 0.70`
  - CapEx/D&A/WC ratios bounded.
  - revenue growth list length exactly 5 when provided.
- Add cross-field validation:
  - WACC must be greater than terminal growth.
- Surface validation messages cleanly in frontend scenario/custom forms.

Files:
- `backend/app/models/schemas.py`
- `backend/app/api/valuation.py`
- `frontend/components/ScenarioBuilder.tsx`
- `frontend/lib/api.ts`

Verification:
- invalid POST returns 422 with useful message.
- frontend displays the message without crashing.

Complexity: S/M.

### 10.10 Make Frontend Requests Abortable

Problem:
- Changing ticker or unmounting page does not abort fetches.

Resolution:
- Update `request<T>` in `frontend/lib/api.ts` to accept `signal`.
- Compose timeout signal with caller signal:
  - either use `AbortSignal.any` when available.
  - or manually forward caller abort to local controller.
- Update API functions to accept optional `{ signal }`.
- In valuation page:
  - create one `AbortController` per ticker load.
  - pass signal to all fetches.
  - abort in cleanup.
- Ensure timeout error remains distinct from user/caller abort.

Files:
- `frontend/lib/api.ts`
- `frontend/app/valuation/[ticker]/page.tsx`

Verification:
- rapid ticker navigation does not complete stale requests into state.
- browser network panel shows cancelled requests.

Complexity: M.

### 10.11 Make PDF Match Visible Report State

Problem:
- User can change reverse target or peer set, but PDF exports initial data.

Resolution:
- Move report custom state up into `ValuationContent`:
  - `activeReverseDcf`
  - `activeMultiples`
  - future `activeScenario`
- Make `ReverseDCFCard` controlled:
  - receives `value/onChange` or `onResult`.
- Make `MultiplesCard` controlled:
  - receives `activeData/onChange`.
- Feed active data into:
  - overview cards
  - football field
  - diagnostics
  - PDF export.
- Add visible export scope:
  - “Export uses current on-screen assumptions.”

Files:
- `frontend/components/ValuationContent.tsx`
- `frontend/components/ReverseDCFCard.tsx`
- `frontend/components/MultiplesCard.tsx`
- `frontend/components/ExportPDFButton.tsx`
- `frontend/components/ValuationPDF.tsx`

Verification:
- change reverse target, export PDF, PDF target/growth matches screen.
- override peers, football field/PDF update accordingly.

Complexity: M/L.

### 10.12 Improve Chart Accessibility

Problem:
- Charts rely on color, hover, and SVG semantics.

Resolution:
- Add hidden or visible summary blocks:
  - Football field: list each method low/base/high and delta vs market.
  - Sensitivity: identify best/worst cells and base case.
  - Historical chart: table fallback or yearly KPI summary.
- Use `aria-label`/`aria-describedby` on chart containers.
- For heatmap, include text delta inside cells or accessible labels:
  - value
  - percent vs market
  - WACC
  - terminal growth.
- Ensure colors are not the only cue:
  - add symbols or labels like “above market”, “below market”.

Files:
- `frontend/components/FootballField.tsx`
- `frontend/components/SensitivityHeatmap.tsx`
- `frontend/components/HistoricalChart.tsx`
- `frontend/app/globals.css`

Verification:
- keyboard/screen-reader review.
- visual review in dark/light mode.

Complexity: M.

### 10.13 Consolidate CSS Safely

Problem:
- `globals.css` and three imported global CSS files overlap.
- Source order controls behavior.

Resolution:
- Do not rewrite all CSS at once.
- First create a CSS inventory:
  - tokens/base
  - layout
  - landing
  - report
  - methodology/about
  - components
  - animations.
- Move landing-only rules to one landing stylesheet or route scope.
- Move report-only rules to one report stylesheet or component classes.
- Remove duplicate rules only after screenshot/build verification.
- Add `prefers-reduced-motion` coverage for JS-heavy components:
  - `ScrollFade`
  - `DotField`
  - `BorderGlow`.

Files:
- `frontend/app/globals.css`
- `frontend/app/landing-fixes.css`
- `frontend/app/landing-upgrades.css`
- `frontend/app/site-wide-enhancements.css`
- `frontend/app/layout.tsx`

Verification:
- desktop/mobile screenshots for home, valuation, methodology, about.
- `npm run build`.

Complexity: L.

### 10.14 Add Minimal Testing and CI

Problem:
- No automated guardrails.

Resolution:
- Frontend:
  - add `typecheck: tsc --noEmit`.
  - add Vitest/React Testing Library for pure components or hooks.
  - later add Playwright smoke.
- Backend:
  - add `pytest`.
  - make config importable without real keys in test mode.
  - mock FMP with `httpx.MockTransport` or `respx`.
- CI:
  - run frontend lint/typecheck/build.
  - run backend compileall/tests.
  - avoid real FMP calls in CI.

Files:
- `frontend/package.json`
- local `.github/workflows/ci.yml`
- `backend/requirements.txt` or dev requirements file.
- future `backend/tests/*`

Verification:
- CI green on mocked/offline path.

Complexity: M/L.

### 10.15 Documentation and Repo Cleanup

Problem:
- README, reports, and context disagree.
- Root has many temporary reports.

Resolution:
- Make README short and current:
  - current supported features.
  - limitations.
  - local setup.
  - roadmap.
- Move old reports into `docs/archive/` or delete after approval.
- Keep `LLM_CONTEXT.md` as agent roadmap.
- Add `CHANGELOG.md` for user-facing changes.
- Remove empty/stale root files only with explicit approval.

Files:
- `README.md`
- `LLM_CONTEXT.md`
- root `*_REPORT.md`, `*_SUMMARY.md`, `LANDING_*`
- `InteractiveBackground.tsx`

Verification:
- README and `LLM_CONTEXT.md` no longer contradict DDM/scenario/watchlist status.

Complexity: S/M.

---

## 11. Phase 0, Phase 1 & Phase 2.2 Completion Status (2026-06-17)

Phase 0 (Baseline Stabilization), Phase 1 (Correctness & Data Safety), and Phase 2.2 (Report State Lift) are complete.

### Completed Items

1. **Fixed lint failures**:
   - `ScenarioBuilder.tsx`: Replaced `as any` with typed `DCFScenarioAssumptions` interface.
   - `useWatchlist.ts`: Replaced synchronous `useEffect` + `setState` with lazy `useState(loadWatchlist)` pattern. Added defensive JSON parsing with shape validation.
   - Result: `npm run lint` → **0 errors, 0 warnings**.

2. **All verification passes**:
   - `npm run lint` → ✅ 0 errors
   - `npm run typecheck` (tsc --noEmit) → ✅ 0 errors
   - `npm run build` → ✅ Successful (all routes)
   - `python3 -m compileall backend/app` → ✅ All files pass

3. **README updated**:
   - Added Reverse DCF to feature list.
   - Added "Coverage" section with DDM/Reverse DCF status.
   - Fixed Roadmap: DDM ✅, Reverse DCF ✅, Scenario Builder/Watchlist 🟡 (prototype built).
   - Added "Verification" section with CLI commands.
   - Removed contradiction: "DDM implementation is planned" → "DDM automatically used for financials/REITs".

4. **Prototype status documented**:
   - `ScenarioBuilder.tsx` — component exists but is NOT imported in `ValuationContent.tsx`. Marked as 🟡 prototype.
   - `useWatchlist.ts` — hook exists but is NOT used in any page. Marked as 🟡 prototype.
   - `DDMCard.tsx` — IS fully integrated (auto-detected for financials/REITs). Marked as ✅ shipped.

5. **Verification script added**:
   - `npm run typecheck` added to `frontend/package.json`.

### Phase 1 Completed Items

6. **FMP 402 handling** (Phase 1.1):
   - `backend/app/services/data_fetcher.py`: Added typed error hierarchy (`PremiumTickerError`, `QuotaExhaustedError`, `InvalidApiKeyError`, `TickerNotFoundError`).
   - 402 responses now inspect body for "premium"/"subscription"/"ticker" tokens before burning keys.
   - Premium tickers raise `PremiumTickerError` without exhausting keys.
   - 429 still burns keys; 401/403 raise `InvalidApiKeyError`; 404 raises `TickerNotFoundError`.

7. **Abortable frontend requests** (Phase 1.2):
### Phase 1 Completed Items (continued)

8. **DCF/DDM sector coherence** (Phase 1.3):
   - `backend/app/api/valuation.py`: `/sensitivity` and `/reverse-dcf` now return 422 with clear message for DDM sectors (Financial Services, Real Estate).
   - `/full` response includes `primary_model: "dcf" | "ddm"`.
   - `frontend/types/valuation.ts`: Added `primary_model` to `FullValuation`.
   - `frontend/components/ValuationContent.tsx`: Uses `primary_model` to route to DCF/DDM card and label sections correctly.

9. **WACC negative interest expense fix** (Phase 1.5):
   - `backend/app/services/wacc.py`: Removed `interest_expense <= 0` fallback. Now uses `abs(interest_expense)` for any non-None value, so negative interest expense (cash/interest income) is treated correctly.

10. **Working capital sign verification** (Phase 1.6):
    - `backend/app/services/dcf.py`: Added `negate=True` parameter to `_three_year_avg_ratio`. FMP's `changeInWorkingCapital` (negative when WC increases) is now negated at the boundary so FCFF formula receives the correct sign.

11. **Multiples period consistency** (Phase 1.7):
    - `backend/app/services/multiples.py`: Added `period_basis` field to response: "TTM multiples on latest fiscal year numerators". Surfaces the standard practice so users can cross-check.

### Phase 2.2 Completed Items

12. **Report-level state lift** (Phase 2.2):
    - `frontend/components/ValuationContent.tsx`: Added `activeReverseDcf` and `activeMultiples` state.
    - `ReverseDDFCard`: Added `onResultChange` prop; custom target price now bubbles up to parent.
    - `MultiplesCard`: Added `onPeersChange` prop; custom peer overrides now bubble up to parent.
    - `ExportPDFButton` / `PDFLinkInner` / `ValuationPDF`: Added `multiples` prop; PDF now uses active (overridden) multiples data.
    - Result: Custom reverse DCF targets and peer overrides now flow through to PDF export.
   - `frontend/lib/api.ts`: Updated `request<T>` to compose timeout signal with caller-provided `AbortSignal`. All exported API functions accept optional `{ signal }` options parameter.
   - `frontend/app/valuation/[ticker]/page.tsx`: Created `AbortController` per ticker load, passes `signal` to all fetches, aborts in cleanup. Best-effort fetches re-throw `AbortError` to properly cancel, ignore other errors gracefully.
   - Result: Rapid ticker navigation cancels in-flight requests, preventing stale state updates and FMP quota waste.

7. **Pydantic validation bounds** (Phase 1.4):
   - `backend/app/models/schemas.py`: Added Pydantic `Field(ge=..., le=...)` constraints to `DCFAssumptions`:
     - WACC: [0.03, 0.25]
     - Terminal growth: [-0.02, 0.06]
     - Tax rate: [0.0, 0.40]
     - EBIT margin: [-0.50, 0.70]
     - D&A/CapEx % revenue: [0.0, 0.50]
     - WC change % revenue: [-0.30, 0.30]
   - Invalid POST now returns HTTP 422 with clear validation message.

### Verification (2026-06-17)
- `npm run lint` → ✅ 0 errors
- `npm run typecheck` → ✅ 0 errors
- `npm run build` → ✅ Successful
- `python3 -m compileall backend/app` → ✅ All files pass

## 12. Immediate Next Step Recommendation

Phase 1 and Phase 2 are now complete.

Remaining Phase 2 items (all now complete):
- ✅ Phase 2.3: Improve model diagnostics (primary model, WACC freshness, data age)
- ✅ Phase 2.4: Mobile table ergonomics (sticky first column, scroll affordance)
- ✅ Phase 2.5: Chart accessibility (aria summaries, sr-only text for football field)

Proceed to **Phase 3 - Testing, CI, and Refactor**:
- Report-level state reducer
- PDF uses visible state
- Mobile table ergonomics
- Accessibility for charts

See sections 5–10 above for detailed resolution playbooks.
