"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ScrollFadeProps {
  children: ReactNode;
  className?: string;
  fadeZone?: number;
  drift?: boolean;
  startFadeAfterScroll?: number;
}

export function ScrollFade({
  children,
  className = "",
  fadeZone = 0.2,
  drift = true,
  startFadeAfterScroll = 0,
}: ScrollFadeProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let rafId: number;

    function update() {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const scrollY = window.scrollY;

      // For hero: don't start fading until user scrolls past threshold
      if (startFadeAfterScroll > 0 && scrollY < startFadeAfterScroll) {
        el.style.opacity = "1";
        el.style.filter = "none";
        el.style.transform = "none";
        return;
      }

      // Calculate progress based on element position in viewport
      const topFraction = rect.top / vh;

      // Opacity: 1 when in view, fades as it scrolls up
      let opacity = 1;
      if (topFraction < fadeZone) {
        opacity = Math.max(0, topFraction / fadeZone);
      }

      // Reset to crisp state when scrolled back to top or below fade zone
      if (scrollY < 50 || topFraction >= fadeZone) {
        el.style.opacity = "1";
        el.style.filter = "none";
        el.style.transform = "none";
      } else {
        el.style.opacity = String(opacity);
        el.style.filter = "none";
        el.style.transform = drift ? `translateY(${-(1 - opacity) * 8}px)` : "none";
      }
    }

    function onScroll() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    }

    el.style.opacity = "1";
    el.style.filter = "none";
    el.style.transform = "none";
    el.style.transition = "none";

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [fadeZone, drift, startFadeAfterScroll]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
