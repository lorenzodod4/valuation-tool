import { TriangleAlert } from "lucide-react";

export function ModelWarnings({ warnings, title = "Model flags" }: { warnings: string[]; title?: string }) {
  if (warnings.length === 0) return null;
  return (
    <div className="notice notice-warn" role="note">
      <TriangleAlert size={16} strokeWidth={1.8} aria-hidden="true" />
      <div>
        <span className="notice-title">
          {title} ({warnings.length})
        </span>
        <ul>
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
