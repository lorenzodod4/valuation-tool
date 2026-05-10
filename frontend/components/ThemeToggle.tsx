"use client";

import { useTheme } from "@/contexts/ThemeContext";

function MoonIcon() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11 7.5A4.5 4.5 0 0 1 5.5 2a4.5 4.5 0 1 0 5.5 5.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx={12} cy={12} r={3} fill="currentColor" />
      <g
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      >
        <line x1={12} y1={2.5} x2={12} y2={5.5} />
        <line x1={12} y1={18.5} x2={12} y2={21.5} />
        <line x1={2.5} y1={12} x2={5.5} y2={12} />
        <line x1={18.5} y1={12} x2={21.5} y2={12} />
        <line x1={5.3} y1={5.3} x2={7.4} y2={7.4} />
        <line x1={16.6} y1={16.6} x2={18.7} y2={18.7} />
        <line x1={5.3} y1={18.7} x2={7.4} y2={16.6} />
        <line x1={16.6} y1={7.4} x2={18.7} y2={5.3} />
      </g>
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Toggle theme to ${next}`}
      className="theme-toggle"
    >
      {/* key={theme} forces a fresh mount so the CSS enter animation replays on toggle */}
      <span key={theme} className="theme-icon">
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
}
