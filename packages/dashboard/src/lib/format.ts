const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(size: number | null): string {
  if (size === null) return "—";
  if (size < 1024) return `${size} B`;

  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return value.slice(0, 10);
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace("T", " ").slice(0, 19);
}

export function formatTimestamp(value: number | null): string {
  if (value === null) return "—";
  return formatDateTime(new Date(value).toISOString());
}

export function formatAgeDays(days: number | null): string {
  if (days === null) return "—";
  return `${days} 天`;
}
