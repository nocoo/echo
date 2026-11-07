import {
  isKnownLatency,
  LATENCY_DOT_COUNT,
  latencyBucket,
  type StatusTone,
  toneClasses,
} from "../../lib/visual";

const DOT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

export function LatencyDots({
  latencyMs,
  tone = "success",
}: {
  latencyMs: number;
  tone?: StatusTone;
}) {
  const classes = toneClasses(tone);

  if (!isKnownLatency(latencyMs)) {
    return (
      <div className="flex items-center gap-basalt-space-sm">
        <span className="text-basalt-xs text-basalt-muted-foreground">—</span>
      </div>
    );
  }

  const filled = latencyBucket(latencyMs);

  return (
    <div className="flex items-center gap-basalt-space-sm">
      <span
        role="img"
        aria-label="圆点数量表示本次查询的本地耗时，不是探测历史"
        className="flex gap-basalt-space-xs"
      >
        {DOT_KEYS.slice(0, LATENCY_DOT_COUNT).map((key, index) => (
          <span
            key={key}
            aria-hidden="true"
            className={`size-1.5 rounded-basalt-full ${
              index < filled ? classes.dot : "bg-basalt-muted"
            }`}
          />
        ))}
      </span>
      <span className={`font-mono text-basalt-xs tabular-nums ${classes.text}`}>{latencyMs}ms</span>
    </div>
  );
}
