"use client";

import { useState } from "react";

const WATCHLIST_KEY = "valuation-watchlist";

export interface WatchlistItem {
  ticker: string;
  addedAt: number;
}

function loadWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(WATCHLIST_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    // Validate shape
    return parsed.filter(
      (item: unknown): item is WatchlistItem =>
        typeof item === "object" &&
        item !== null &&
        "ticker" in item &&
        typeof (item as WatchlistItem).ticker === "string" &&
        "addedAt" in item &&
        typeof (item as WatchlistItem).addedAt === "number"
    );
  } catch {
    return [];
  }
}

export function useWatchlist() {
  const [items, setItems] = useState<WatchlistItem[]>(loadWatchlist);

  const add = (ticker: string) => {
    const upper = ticker.toUpperCase();
    setItems((prev) => {
      if (prev.some((i) => i.ticker === upper)) return prev;
      const next = [...prev, { ticker: upper, addedAt: Date.now() }];
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
      return next;
    });
  };

  const remove = (ticker: string) => {
    const upper = ticker.toUpperCase();
    setItems((prev) => {
      const next = prev.filter((i) => i.ticker !== upper);
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
      return next;
    });
  };

  const has = (ticker: string) => {
    return items.some((i) => i.ticker === ticker.toUpperCase());
  };

  const clear = () => {
    setItems([]);
    localStorage.removeItem(WATCHLIST_KEY);
  };

  return { items, add, remove, has, clear, isLoaded: true };
}
