"use client";

import { useEffect, useState } from "react";

interface ReportNavProps {
  sections: Array<{ id: string; label: string }>;
}

/** Sticky in-report navigation that tracks the section in view. */
export function ReportNav({ sections }: ReportNavProps) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el != null);
    if (els.length === 0 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav className="report-nav" aria-label="Report sections">
      <div className="container report-nav-inner">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="report-nav-link"
            aria-current={active === s.id ? "location" : undefined}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
