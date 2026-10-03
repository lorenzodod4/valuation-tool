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
hero (1.2 s scene build-up, then a slow 14 s "discount-rate breath"). Financial figures
never animate. `prefers-reduced-motion` and Save-Data get the static SVG poster and
three.js is not downloaded.

## Hero scene
`components/hero/DiscountField.tsx`. Columns are the illustrative company's projected
FCFF: wireframe = nominal cash flow, plate stack = present value. Heights come from the
same DCF engine as the demo (`lib/dcf-engine.ts`). Render loop pauses off-screen and in
hidden tabs; DPR capped at 1.75 (1.5 on small screens).

## Components
Buttons (`btn-primary/secondary/ghost`), `input`, `ticker-search`, `chip`, `badge-*`,
`notice-*`, `panel`, `data-table`, `kpi`, `RangeChart`, `ReportSection`, `SectionState`.
