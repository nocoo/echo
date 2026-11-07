import {
  compressIpv6,
  contains,
  expandIpv6,
  isIpv4,
  isIpv6,
  maskToPrefix,
  type PrefixRow,
  prefixTable,
  prefixToMask,
  toBinary,
  toHex,
} from "../../lib/ip-math";

export interface CidrConversion {
  prefix: number | null;
  mask: string | null;
  error: string | null;
}

export interface IpView {
  ip: string;
  binary: string;
  hex: string;
  expanded: string | null;
  compressed: string | null;
  error: string | null;
}

export interface ContainmentResult {
  contains: boolean | null;
  error: string | null;
}

const DECIMAL_PREFIX = /^\d{1,2}$/;

export function convertCidr(input: string): CidrConversion {
  const text = input.trim();
  if (!text) return { prefix: null, mask: null, error: null };

  const slash = text.indexOf("/");
  if (slash >= 0) {
    const network = text.slice(0, slash);
    if (!isIpv4(network)) {
      return { prefix: null, mask: null, error: "CIDR 的地址部分必须是有效 IPv4" };
    }
    const prefix = parsePrefix(text.slice(slash + 1));
    if (prefix === null) {
      return { prefix: null, mask: null, error: "前缀必须是 0-32 的十进制整数" };
    }
    return { prefix, mask: prefixToMask(prefix), error: null };
  }

  if (text.includes(".")) {
    const prefix = maskToPrefix(text);
    if (prefix === null) {
      return { prefix: null, mask: null, error: "掩码必须是连续的 1 后接 0" };
    }
    return { prefix, mask: text, error: null };
  }

  const prefix = parsePrefix(text);
  if (prefix === null) {
    return { prefix: null, mask: null, error: "请输入前缀、掩码或 CIDR" };
  }
  return { prefix, mask: prefixToMask(prefix), error: null };
}

function parsePrefix(raw: string): number | null {
  if (!DECIMAL_PREFIX.test(raw)) return null;
  const prefix = Number(raw);
  return prefix <= 32 ? prefix : null;
}

export function buildPrefixRows(ip: string): { rows: PrefixRow[]; error: string | null } {
  const text = ip.trim();
  if (!text) return { rows: [], error: null };
  if (!isIpv4(text)) return { rows: [], error: "请输入 IPv4 地址" };
  return { rows: prefixTable(text), error: null };
}

export function evaluateContainment(cidr: string, ip: string): ContainmentResult {
  const network = cidr.trim();
  const target = ip.trim();
  if (!network || !target) return { contains: null, error: null };
  if (!isIpv4(target) && !isIpv6(target)) {
    return { contains: null, error: "请输入有效的地址" };
  }
  return { contains: contains(network, target), error: null };
}

export function buildIpView(ip: string): IpView {
  const text = ip.trim();
  if (!text) {
    return { ip: text, binary: "", hex: "", expanded: null, compressed: null, error: null };
  }

  try {
    const ipv6 = isIpv6(text);
    return {
      ip: text,
      binary: toBinary(text),
      hex: toHex(text),
      expanded: ipv6 ? expandIpv6(text) : null,
      compressed: ipv6 ? compressIpv6(text) : null,
      error: null,
    };
  } catch {
    return {
      ip: text,
      binary: "",
      hex: "",
      expanded: null,
      compressed: null,
      error: "无法解析该地址",
    };
  }
}
