"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";

export interface ThemeColors {
  accent: string;
  bull: string;
  bear: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  borderDefault: string;
  cyan?: string;
}

const DEFAULT_COLORS: ThemeColors = {
  accent: "#6366F1",
  bull: "#16A34A",
  bear: "#DC2626",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textTertiary: "#64748B",
  borderDefault: "#E5E7EB",
};

function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

export function useThemeColors(extraVars?: Record<string, string>): ThemeColors {
  const { theme } = useTheme();
  const [colors, setColors] = useState<ThemeColors | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setColors({
        accent: readVar("--accent", DEFAULT_COLORS.accent),
        bull: readVar("--bull", DEFAULT_COLORS.bull),
        bear: readVar("--bear", DEFAULT_COLORS.bear),
        textPrimary: readVar("--text-primary", DEFAULT_COLORS.textPrimary),
        textSecondary: readVar("--text-secondary", DEFAULT_COLORS.textSecondary),
        textTertiary: readVar("--text-tertiary", DEFAULT_COLORS.textTertiary),
        borderDefault: readVar("--border-default", DEFAULT_COLORS.borderDefault),
        ...(extraVars
          ? Object.fromEntries(
              Object.entries(extraVars).map(([key, cssVar]) => [
                key,
                readVar(cssVar, key),
              ]),
            )
          : {}),
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [theme, extraVars]);

  return colors ?? DEFAULT_COLORS;
}