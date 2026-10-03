import { CircleSlash, RotateCcw, TriangleAlert } from "lucide-react";
import type { Async } from "@/lib/async";

interface SectionStateProps<T> {
  state: Exclude<Async<T>, { status: "ok" }>;
  label: string;
  height?: number;
  onRetry?: () => void;
}

/** Loading / not-applicable / failed placeholder for a report section. */
export function SectionState<T>({ state, label, height = 220, onRetry }: SectionStateProps<T>) {
  if (state.status === "loading") {
    return (
      <div className="section-loading" style={{ minHeight: height }} role="status">
        <div className="skeleton" style={{ height: height - 40 }} />
        <span className="sr-only">Loading {label}…</span>
      </div>
    );
  }
  if (state.status === "na") {
    return (
      <div className="notice notice-info">
        <CircleSlash size={16} strokeWidth={1.8} aria-hidden="true" />
        <div>
          <span className="notice-title">{label} not applicable</span>
          {state.reason}
        </div>
      </div>
    );
  }
  return (
    <div className="notice notice-neg" role="alert">
      <TriangleAlert size={16} strokeWidth={1.8} aria-hidden="true" />
      <div>
        <span className="notice-title">{label} could not be loaded</span>
        {state.error.message}
        {onRetry ? (
          <div style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
              <RotateCcw size={13} strokeWidth={1.8} aria-hidden="true" /> Retry
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
