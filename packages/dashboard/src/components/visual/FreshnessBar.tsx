import { type DataStatus, freshnessRatio, statusTone, toneClasses } from "../../lib/visual";

export function FreshnessBar({
  ageDays,
  status,
  className,
}: {
  ageDays: number | null;
  status: DataStatus;
  className?: string;
}) {
  const tone = toneClasses(statusTone(status));
  const ratio = freshnessRatio(ageDays);

  return (
    <div
      className={
        className
          ? `flex items-center gap-basalt-space-sm ${className}`
          : "flex items-center gap-basalt-space-sm"
      }
    >
      <div className="h-1.5 flex-1 overflow-hidden rounded-basalt-full bg-basalt-muted">
        <div
          className={`h-full rounded-basalt-full ${tone.dot}`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      <span className={`font-mono text-basalt-xs tabular-nums ${tone.text}`}>
        {ageDays === null ? "—" : `${ageDays}d`}
      </span>
    </div>
  );
}
