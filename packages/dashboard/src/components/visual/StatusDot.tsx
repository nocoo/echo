import { type StatusTone, toneClasses } from "../../lib/visual";

export function StatusDot({ tone, className }: { tone: StatusTone; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 shrink-0 rounded-basalt-full ${toneClasses(tone).dot}${
        className ? ` ${className}` : ""
      }`}
    />
  );
}
