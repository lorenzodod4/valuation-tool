"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search } from "lucide-react";

const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,9}$/;

function isTyping(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

/**
 * Compact ticker search for every page except home (which has the hero search).
 * "/" focuses the nearest ticker field from anywhere on the site.
 */
export function HeaderSearch({ onHome }: { onHome: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return;
      const target = onHome
        ? document.querySelector<HTMLInputElement>("#analyze input")
        : inputRef.current?.offsetParent
          ? inputRef.current
          : null;
      if (!target) return;
      e.preventDefault();
      target.focus();
      target.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onHome]);

  if (onHome) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = value.trim().toUpperCase();
    if (!TICKER_PATTERN.test(t)) {
      setInvalid(true);
      return;
    }
    setValue("");
    inputRef.current?.blur();
    router.push(`/valuation/${encodeURIComponent(t)}`);
  };

  return (
    <>
      <form className="header-search" role="search" onSubmit={submit}>
        <Search size={14} strokeWidth={1.9} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.toUpperCase());
            setInvalid(false);
          }}
          placeholder="Ticker"
          maxLength={10}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="Value another ticker"
          aria-invalid={invalid}
          aria-keyshortcuts="/"
          enterKeyHint="go"
        />
        <kbd aria-hidden="true">/</kbd>
      </form>
      <Link href="/#analyze" className="header-search-mobile" aria-label="Value another ticker">
        <Search size={16} strokeWidth={1.9} aria-hidden="true" />
      </Link>
    </>
  );
}
