import { LATENCY_DOT_COUNT, latencyBucket, type StatusTone, toneClasses } from "../../lib/visual";

const DOT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

export function LatencyDots({
  latencyMs,
  tone = "success",
}: {
  latencyMs: number;
  tone?: StatusTone;
}) {
  const filled = latencyBucket(latencyMs);
  const classes = toneClasses(tone);

  return (
    <div className="flex items-center gap-basalt-space-sm">
      <span aria-hidden="true" className="flex gap-0.5">
        {DOT_KEYS.slice(0, LATENCY_DOT_COUNT).map((key, index) => (
          <span
            key={key}
            className={`size-1.5 rounded-full ${index < filled ? classes.dot : "bg-basalt-muted"}`}
          />
        ))}
      </span>
      <span className={`font-mono text-xs tabular-nums ${classes.text}`}>{latencyMs}ms</span>
    </div>
  );
}
