import type { ReactNode } from "react";

interface ReportSectionProps {
  id: string;
  index: string;
  title: string;
  subtitle?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}

export function ReportSection({ id, index, title, subtitle, aside, children }: ReportSectionProps) {
  const headingId = `${id}-title`;
  return (
    <section id={id} className="report-section" aria-labelledby={headingId}>
      <header className="report-section-head">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-index">{index}</span>
          </p>
          <h2 id={headingId} className="report-section-title">
            {title}
          </h2>
          {subtitle ? <p className="report-section-sub">{subtitle}</p> : null}
        </div>
        {aside ? <div className="report-section-aside">{aside}</div> : null}
      </header>
      <div className="report-section-body">{children}</div>
    </section>
  );
}
