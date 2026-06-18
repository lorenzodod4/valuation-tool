# Rollback Guide — UI/UX Improvements

## Quick Rollback

If you need to revert all changes:

```bash
cd /Users/lorenzododero/Desktop/valuation-tool
git checkout -- frontend/app/globals.css
```

## Changes by Block

### BLOCK 2 — Layout Centering
**File:** `frontend/app/globals.css`

Revert these CSS classes to original (760px max-width):
```css
.page-content
.landing-content
.landing-section
.landing-section-header
.workflow-grid
.feature-cards-grid
.trust-section
.valuation-content
.about-content
.methodology-content
```

**Original `.page-content`:**
```css
.page-content {
  position: relative;
  z-index: 1;
  flex: 1;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 90px 32px 80px;
  text-align: center;
}
```

### BLOCK 3 — Homepage Entrance
**File:** `frontend/app/globals.css`

Revert these CSS classes:
```css
.landing-hero-shell (grid-template-columns: 1fr → 1fr 1fr)
.entrance-copy (text-align: center → left)
.landing-hero-stack (grid-template-columns: minmax(320px, 0.82fr) minmax(0, 1.18fr) → 1fr)
```

**Original `.landing-hero-shell`:**
```css
.landing-hero-shell {
  position: relative;
  z-index: 2;
  width: min(1180px, 100%);
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  gap: clamp(28px, 5vh, 48px);
  padding: 0;
}
```

### BLOCK 5 — DotField Visibility
**File:** `frontend/app/globals.css`

Revert light mode tokens in `:root, [data-theme="light"]`:
```css
--dot-field-from: rgba(2, 132, 199, 0.34);  /* was 0.52 */
--dot-field-to: rgba(15, 23, 42, 0.26);     /* was 0.42 */
--dot-field-glow: rgba(14, 165, 233, 0.13); /* was 0.22 */
```

### BLOCK 11 — Light Mode
**File:** `frontend/app/globals.css`

Revert entire `:root, [data-theme="light"]` block to original values.

**Key reverts:**
```css
--bg-primary: #FAFAF9;           /* was #FFFFFF */
--bg-card: rgba(255, 255, 255, 0.75);      /* was 0.95 */
--bg-input: rgba(255, 255, 255, 0.7);      /* was 0.8 */
--border-default: #E5E7EB;      /* was #D1D5DB */
--border-strong: #CBD5E1;       /* was #9CA3AF */
--text-primary: #0F172A;        /* was #111827 */
--text-secondary: #1E293B;      /* was #374151 */
--text-tertiary: #334155;       /* was #6B7280 */
--shadow-card: 0 2px 12px rgba(15, 23, 42, 0.04); /* was 0 1px 3px rgba(0, 0, 0, 0.06) */
```

### BLOCK 12 — Live Pill
**File:** `frontend/app/globals.css`

Revert animation:
```css
@keyframes live-pulse {
  0%,
  100% {
    opacity: 0.72;      /* was 0.8 */
    transform: scale(0.92);  /* was 0.96 */
  }
  50% {
    opacity: 1;
    transform: scale(1.08);  /* was 1.04 */
  }
}

.live-dot {
  animation: live-pulse 1.5s ease-in-out infinite;  /* was 2s */
  box-shadow: 0 0 0 3px var(--bull-soft), 0 0 10px rgba(52, 211, 153, 0.28); /* was 0 0 8px */
}
```

## Testing After Rollback

```bash
cd frontend
npm run build
npx tsc --noEmit
npm run dev
```

Visit http://localhost:3000 and verify:
- Homepage layout is centered (narrower)
- Hero is single column
- Light mode uses original colors
- Live pill pulses in original pattern

## Git Verification

To see all changes made:
```bash
git diff frontend/app/globals.css
```

To see only CSS changes:
```bash
git diff frontend/app/globals.css | grep "^[+-]" | head -100
```

## No Component Changes

These files were NOT modified (already correct):
- `frontend/components/BorderGlow.tsx` ✅
- `frontend/components/Folder.tsx` ✅

No rollback needed for these.

---

**END ROLLBACK GUIDE**
