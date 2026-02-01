import { isIP } from "node:net";

export type ParsedIp = {
  ip: string;
  version: 4 | 6;
};

export function normalizeIp(input: string): string {
  const trimmed = input.trim();

  if (trimmed.startsWith("::ffff:")) {
    return trimmed.replace("::ffff:", "");
  }

  return trimmed;
}

export function extractClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return null;
}

export function parseClientIp(ip: string | null): ParsedIp | null {
  if (!ip) {
    return null;
  }

  const normalized = normalizeIp(ip);
  const version = isIP(normalized);

  if (version === 4 || version === 6) {
    return { ip: normalized, version };
  }

  return null;
}
