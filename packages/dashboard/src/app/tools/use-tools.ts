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

export function convertCidr(input: string): CidrConversion {
  const text = input.trim();
  if (!text) return { prefix: null, mask: null, error: null };

  if (text.includes("/")) {
    const raw = text.slice(text.indexOf("/") + 1);
    const prefix = Number(raw);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
      return { prefix: null, mask: null, error: "前缀必须是 0-32 的整数" };
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

  const prefix = Number(text);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return { prefix: null, mask: null, error: "请输入前缀、掩码或 CIDR" };
  }
  return { prefix, mask: prefixToMask(prefix), error: null };
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
