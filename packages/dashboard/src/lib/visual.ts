import type { DatabaseEntry, IpLocation, ProviderResult } from "./api";

export type StatusTone = "success" | "warning" | "destructive" | "muted";

export type DataStatus = "ok" | "stale" | "missing" | "error" | "idle";

export type ProviderOutcome = "hit" | "miss" | "error";

export interface ToneClasses {
  dot: string;
  text: string;
}

export interface ProviderAccent {
  surface: string;
}

export interface ProviderField {
  label: string;
  value: string;
}

export const NEUTRAL_FLAG = "🌐";

export const FRESHNESS_THRESHOLD_DAYS = 7;

export const LATENCY_DOT_COUNT = 10;

const REGIONAL_INDICATOR_BASE = 0x1f1e6;

const PROVIDER_ACCENTS: Record<string, ProviderAccent> = {
  ip2region: { surface: "bg-basalt-chart-1/15" },
  iplocate: { surface: "bg-basalt-chart-2/15" },
  "ip-location-db": { surface: "bg-basalt-chart-3/15" },
  circl: { surface: "bg-basalt-chart-4/15" },
};

const MUTED_ACCENT: ProviderAccent = { surface: "bg-basalt-muted" };

const TONE_CLASSES: Record<StatusTone, ToneClasses> = {
  success: { dot: "bg-basalt-success", text: "text-basalt-success" },
  warning: { dot: "bg-basalt-tag-warning-foreground", text: "text-basalt-tag-warning-foreground" },
  destructive: {
    dot: "bg-basalt-tag-danger-foreground",
    text: "text-basalt-tag-danger-foreground",
  },
  muted: { dot: "bg-basalt-muted-foreground", text: "text-basalt-muted-foreground" },
};

const OUTCOME_LABELS: Record<ProviderOutcome, string> = {
  hit: "已命中",
  miss: "无地理信息",
  error: "查询失败",
};

export function flagForCountry(code: string | null | undefined): string {
  const normalized = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return NEUTRAL_FLAG;

  const first = REGIONAL_INDICATOR_BASE + normalized.charCodeAt(0) - 65;
  const second = REGIONAL_INDICATOR_BASE + normalized.charCodeAt(1) - 65;
  return String.fromCodePoint(first, second);
}

export function truncateMiddle(value: string, maxLength: number): string {
  if (maxLength < 3) return value;
  if (value.length <= maxLength) return value;

  const keep = maxLength - 1;
  const head = Math.ceil((keep * 2) / 3);
  const tail = keep - head;
  return `${value.slice(0, head)}…${tail > 0 ? value.slice(value.length - tail) : ""}`;
}

export function statusTone(status: DataStatus): StatusTone {
  if (status === "ok") return "success";
  if (status === "stale") return "warning";
  if (status === "missing" || status === "error") return "destructive";
  return "muted";
}

export function toneClasses(tone: StatusTone): ToneClasses {
  return TONE_CLASSES[tone];
}

export function isKnownLatency(latencyMs: number): boolean {
  return Number.isFinite(latencyMs);
}

export function latencyBucket(latencyMs: number): number {
  if (!isKnownLatency(latencyMs)) return 0;

  const scaled = 10 - Math.round(((latencyMs - 5) / 195) * 9);
  return Math.min(LATENCY_DOT_COUNT, Math.max(1, scaled));
}

export function providerAccent(provider: string): ProviderAccent {
  return PROVIDER_ACCENTS[provider] ?? MUTED_ACCENT;
}

export function freshnessRatio(
  ageDays: number | null,
  thresholdDays: number = FRESHNESS_THRESHOLD_DAYS,
): number {
  if (ageDays === null || !Number.isFinite(ageDays) || thresholdDays <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - ageDays / thresholdDays));
}

export function totalSizeBytes(entries: DatabaseEntry[]): number {
  return entries.reduce((total, entry) => total + (entry.size ?? 0), 0);
}

export function providerFields(location: IpLocation | null): ProviderField[] {
  if (!location) return [];

  const fields: ProviderField[] = [];
  const push = (label: string, value: string | number | null) => {
    if (value === null) return;
    const text = String(value).trim();
    if (text.length === 0) return;
    fields.push({ label, value: text });
  };

  push("国家", location.country);
  push("省份", location.province);
  push("城市", location.city);
  push("ISP", location.isp);
  push("ASN", location.asn);
  push("组织", location.asOrg);

  return fields;
}

export function providerOutcome(provider: ProviderResult): ProviderOutcome {
  if (provider.error) return "error";
  if (provider.location === null) return "miss";
  return "hit";
}

export function outcomeTone(outcome: ProviderOutcome): StatusTone {
  if (outcome === "hit") return "success";
  if (outcome === "error") return "destructive";
  return "muted";
}

export function outcomeLabel(outcome: ProviderOutcome): string {
  return OUTCOME_LABELS[outcome];
}
