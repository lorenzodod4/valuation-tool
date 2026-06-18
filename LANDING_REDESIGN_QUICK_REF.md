# Landing Page Redesign — Quick Reference

## Key Metric Changes

### Hero Section
```
Height:        200vh → 140vh (more focused)
Top Padding:   clamp(100px, 12vh, 160px) → clamp(120px, 14vh, 180px)
Title Size:    clamp(56px, 8vw, 88px) → clamp(60px, 8.5vw, 96px)
Subtitle Size: clamp(16px, 2.2vw, 18px) → clamp(17px, 2.4vw, 19px)
Hero Gap:      clamp(100px, 15vh, 200px) → clamp(100px, 14vh, 180px)
Max Width:     750px → 820px (copy)
```

### Dashboard Stack
```
Perspective:    1400px → 1600px
Card Height:    420px → 480px
Terminal:       translateY(-20px) translateX(-32px) skewY(-2.5deg) rotateX(2deg)
            →   translateY(-32px) translateX(-40px) skewY(-3deg) rotateX(3deg)
Preview:        translateY(60px) translateX(32px) skewY(2.5deg) rotateX(-2deg)
            →   translateY(72px) translateX(40px) skewY(3deg) rotateX(-3deg)
```

### Content Sections
```
Top Margin:     0 auto → -120px auto 0 (reduces gap!)
Bottom Padding: 124px → 160px
Section Gap:    88px → 120px
Header Margin:  26px → 48px
Card Padding:   22px → 28px 24px
CTA Padding:    clamp(28px, 5vw, 54px) → clamp(48px, 6vw, 72px)
```

### Scroll Behavior
```
Hero Fade Zone:    0.3 → 0.25
Content Fade Zone: 0.15 → 0.18
Blur Effect:       blur(1.5px) → none (removed)
Drift Distance:    20px → 12px
Reset Trigger:     Complex → scrollY < 50 (deterministic)
```

---

## Visual Flow

### Before
```
┌─────────────────────┐
│   HERO (too tall)   │  ← Separated
│                     │
│                     │
└─────────────────────┘
        ↓ Big gap
┌─────────────────────┐
│  Content (squished) │  ← Compressed
│  88px spacing       │
└─────────────────────┘
```

### After
```
┌─────────────────────┐
│   HERO (focused)    │
│   More centered     │  ← Premium
│   Larger text       │
└─────────────────────┘
        ↓ -120px overlap
┌─────────────────────┐
│  Content (breathes) │  ← Spacious
│  120px spacing      │  ← Longer
│  More padding       │
└─────────────────────┘
```

---

## Component Changes

### ScrollFade.tsx
- ❌ Removed: Blur filter (caused reset issues)
- ❌ Removed: Complex state tracking
- ✅ Added: Deterministic scroll position check
- ✅ Added: Explicit reset when scrollY < 50
- ✅ Simplified: Opacity-only fade (no filters)

### landing-fixes.css
- 📐 Redesigned: All hero layout rules
- 📐 Redesigned: Content spacing architecture
- 📐 Enhanced: 3D perspective and transforms
- 📐 Increased: All padding and margins
- 📐 Improved: Responsive breakpoints

### page.tsx
- 🎚️ Adjusted: ScrollFade fadeZone values
- 🎚️ Updated: Comments to match new behavior

---

## Color & Style

No changes to:
- Color palette (Bloomberg-lite preserved)
- Typography families (Inter + SF Mono)
- Border styles (institutional restraint)
- Button designs (consistent)
- Icons or illustrations (none added)

---

## Browser Support

Tested & Works:
✅ Chrome/Edge (latest)
✅ Safari (latest)
✅ Firefox (latest)
✅ Mobile Safari iOS
✅ Chrome Android

Features Used:
- CSS clamp() (widely supported)
- CSS transforms 3D (widely supported)
- requestAnimationFrame (universal)
- Flexbox/Grid (universal)

---

## Performance

### Before
- willChange: opacity, transform, filter
- Blur filter: GPU layer
- Complex state tracking

### After
- No willChange (cleaner reset)
- No blur filter (simpler compositing)
- Direct style manipulation
- RAF-based updates (60fps)

---

## Mobile Responsiveness

### Breakpoints
- Desktop: > 1024px (full layout)
- Tablet: 768px - 1024px (simplified)
- Mobile: < 768px (stacked)

### Mobile Changes
- Hero: 72px top padding (was variable)
- Content gap: -60px (was -120px)
- Section spacing: 80px (was 120px)
- Single column throughout
- No 3D transforms on mobile

---

## Quick Test Commands

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Build
npm run build

# Dev server
npm run dev
```

All passing ✓

---

## File Locations

```
frontend/
├── components/
│   └── ScrollFade.tsx          (simplified, no blur)
├── app/
│   ├── page.tsx                (adjusted fade zones)
│   └── landing-fixes.css       (complete redesign)
└── [other files unchanged]
```

---

## Summary

**What Changed:**
- Hero: More centered, premium, larger text
- Gap: -120px overlap for continuous flow
- Spacing: +36% more breathing room (88→120px)
- Cards: +60px taller (420→480px)
- 3D depth: +200px perspective
- Scroll: No blur, crisp reset guaranteed

**Result:**
A longer, more premium, centered landing experience with seamless scroll flow and deterministic reset behavior.
