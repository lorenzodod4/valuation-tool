# Design system — "The Discounting Instrument"

Tokens live in `frontend/app/styles/tokens.css`; every other stylesheet consumes them.
Dark (graphite) is the signature theme and light (paper) is an equal; both are defined
for the OS preference and for the explicit toggle (`data-theme`).

## Principles
- **Numbers are content.** Tables and inline figures use IBM Plex Mono with tabular,
  slashed-zero numerals; large display figures use Inter Tight with tabular numerals.
  Negatives use a true minus sign (−$12.34). Missing values are "—", never NaN or 0.
- **One signal hue.** `--signal` marks the brand, the primary model and focus. Peer
  methods and secondary data stay neutral. `--pos`/`--neg`/`--warn` are reserved for
  status and always come with a sign, icon or label.
- **Disclose, don't decorate.** No chart without data; no decorative numbers.

## Type
Inter Tight (UI), Instrument Serif italic (one accent phrase per headline at most),
IBM Plex Mono (numbers, labels). Self-hosted via `next/font/local` (OFL).

## Colour (validated)
Categorical series, CVD ΔE ≥ 9 on adjacent pairs (dataviz validator):
- light `#2F55E4 · #E0682B · #159A72` on `#FFFFFF`
- dark  `#5B7BF5 · #DA6A31 · #1FA078` on `#13161B`

Sensitivity heat is diverging pos/neg around the market price; every cell also prints
its signed delta so the colour is never the only encoding.

## Motion
Three tiers: micro (140 ms, state), major (520 ms, one fade-up per block on first view),
hero (1.2 s fade-in, then a 3.4 s hold / 1.8 s morph cycle between acts). Financial
figures never animate. `prefers-reduced-motion`, Save-Data and missing WebGL get the
static SVG poster and three.js is not downloaded.

## Hero scene
`components/hero/Constellation.tsx` — one particle system in three acts: **Market**
(a turning sphere: every company), **Price** (a candlestick chart of one illustrative
stock with its last price) and **Value** (a football field of valuation ranges against
the market-price marker). The cursor parts the particles; the stepper jumps between acts.
Shared geometry lives in `constellationModel.ts`; `HeroPoster.tsx` is the server-rendered
static final act. Render loop pauses off-screen and in hidden tabs; DPR capped at 2;
11k particles on desktop, 4.2k on phones. Additive blending on graphite, normal on paper.

## Interaction
- Report DCF has a **What if?** panel (`components/report/DCFScenario.tsx`): WACC,
  terminal growth, Y1 growth and EBIT margin run through the client engine from the
  server's own inputs (`lib/dcf-scenario.ts`, parity-tested). No API request; the
  report, range chart and PDF keep the server's base case.
- Range chart rows show a tooltip (base, range, vs market) and open their section on click.
- Sensitivity cells show a crosshair and a readout against the base case.
- Header ticker search on every page except home; `/` focuses the nearest ticker field.

## PDF
`components/ValuationPDF.tsx`, A4, paper palette, the site's typefaces as static TTFs in
`public/fonts/pdf` (OFL). Order: summary + football field → model → reverse DCF +
sensitivity (DCF only) → comparables → history, company and sources. Charts are drawn
from the same numbers as the web report; nothing is recomputed.

## Components
Buttons (`btn-primary/secondary/ghost`), `input`, `ticker-search`, `chip`, `badge-*`,
`notice-*`, `panel`, `data-table`, `kpi`, `RangeChart`, `ReportSection`, `SectionState`.
