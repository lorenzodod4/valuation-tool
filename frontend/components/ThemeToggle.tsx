"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Switch colour theme"
      className="icon-button"
    >
      <Sun className="theme-icon-sun" size={15} strokeWidth={1.7} aria-hidden="true" />
      <Moon className="theme-icon-moon" size={15} strokeWidth={1.7} aria-hidden="true" />
    </button>
  );
}
