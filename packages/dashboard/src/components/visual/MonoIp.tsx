import { truncateMiddle } from "../../lib/visual";

export function MonoIp({
  value,
  variant = "full",
  maxLength = 24,
  className,
}: {
  value: string;
  variant?: "full" | "middle";
  maxLength?: number;
  className?: string;
}) {
  const text = variant === "middle" ? truncateMiddle(value, maxLength) : value;
  return (
    <span className={className ? `font-mono tabular-nums ${className}` : "font-mono tabular-nums"}>
      {text}
    </span>
  );
}
