"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { HeaderSearch } from "@/components/HeaderSearch";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { href: "/methodology", label: "Methodology", optional: false },
  { href: "/about", label: "About", optional: true },
];

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="site-header" data-scrolled={scrolled}>
      <div className="container site-header-inner">
        <Link href="/" className="brand" aria-label="Valuation.io home">
          <BrandMark />
          <span>
            Valuation<span className="brand-suffix">.io</span>
          </span>
        </Link>
        <nav className="site-nav" aria-label="Primary">
          <HeaderSearch onHome={pathname === "/"} />
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${item.optional ? " nav-link-optional" : ""}`}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
