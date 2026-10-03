"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "li";
  id?: string;
  "aria-labelledby"?: string;
}

/** Major-tier motion: a single fade-up when the block first enters view. */
export function Reveal({ children, className = "", as: Tag = "div", ...rest }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => {
      el.dataset.visible = "true";
    };
    if (typeof IntersectionObserver === "undefined") return show();
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          show();
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref as never} className={`reveal ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
