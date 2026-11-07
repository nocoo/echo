const IPV4_OCTET = /^(0|[1-9]\d{0,2})$/;
const IPV6_GROUP = /^[0-9a-fA-F]{1,4}$/;

export interface Ipv4Network {
  ip: string;
  prefix: number;
  mask: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalAddresses: number;
  usableHosts: number;
}

export interface PrefixRow {
  prefix: number;
  mask: string;
  network: string;
  broadcast: string;
  usableHosts: number;
}

export function parseIpv4(ip: string): [number, number, number, number] | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;

  const octets: number[] = [];
  for (const part of parts) {
    if (!IPV4_OCTET.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }

  const [a, b, c, d] = octets as [number, number, number, number];
  return [a, b, c, d];
}

export function isIpv4(ip: string): boolean {
  return parseIpv4(ip) !== null;
}

export function parseIpv6(ip: string): number[] | null {
  const text = ip.trim();
  if (!text) return null;

  const lastColon = text.lastIndexOf(":");
  if (lastColon < 0) return null;

  let body = text;
  let embedded: number[] | null = null;

  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const octets = parseIpv4(tail);
    if (!octets) return null;
    const [a, b, c, d] = octets;
    embedded = [(a << 8) | b, (c << 8) | d];
    const markerColon = lastColon > 0 && text[lastColon - 1] === ":";
    body = text.slice(0, markerColon ? lastColon + 1 : lastColon);
  }

  const marker = body.indexOf("::");
  if (marker < 0) {
    if (body.endsWith(":")) return null;
    const groups = parseGroupList(body);
    if (!groups) return null;
    const total = groups.length + (embedded?.length ?? 0);
    if (total !== 8) return null;
    return embedded ? [...groups, ...embedded] : groups;
  }

  if (body.indexOf("::", marker + 2) >= 0) return null;

  const left = parseGroupList(body.slice(0, marker));
  if (!left) return null;

  const right = parseGroupList(body.slice(marker + 2));
  if (!right) return null;

  const total = left.length + right.length + (embedded?.length ?? 0);
  if (total > 7) return null;

  const groups = [...left, ...new Array<number>(8 - total).fill(0), ...right];
  if (embedded) groups.push(...embedded);
  return groups;
}

export function isIpv6(ip: string): boolean {
  return parseIpv6(ip) !== null;
}

export function ipv4ToNumber(ip: string): number {
  const octets = parseIpv4(ip);
  if (!octets) throw new Error(`invalid ipv4 address: ${ip}`);
  const [a, b, c, d] = octets;
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

export function numberToIpv4(value: number): string {
  const n = value >>> 0;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function prefixToMask(prefix: number): string {
  return numberToIpv4(ipv4Mask(prefix));
}

export function maskToPrefix(mask: string): number | null {
  const octets = parseIpv4(mask);
  if (!octets) return null;

  let prefix = 0;
  let seenZero = false;
  for (const octet of octets) {
    for (let bit = 7; bit >= 0; bit--) {
      if ((octet & (1 << bit)) !== 0) {
        if (seenZero) return null;
        prefix++;
      } else {
        seenZero = true;
      }
    }
  }
  return prefix;
}

export function networkAddress(ip: string, prefix: number): string {
  return numberToIpv4((ipv4ToNumber(ip) & ipv4Mask(prefix)) >>> 0);
}

export function broadcastAddress(ip: string, prefix: number): string {
  const mask = ipv4Mask(prefix);
  const network = (ipv4ToNumber(ip) & mask) >>> 0;
  return numberToIpv4((network | (~mask >>> 0)) >>> 0);
}

export function usableHostCount(prefix: number): number {
  assertIpv4Prefix(prefix);
  if (prefix === 32) return 1;
  if (prefix === 31) return 2;
  return 2 ** (32 - prefix) - 2;
}

export function describeNetwork(ip: string, prefix: number): Ipv4Network {
  const mask = ipv4Mask(prefix);
  const network = (ipv4ToNumber(ip) & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  const usable = usableHostCount(prefix);
  const firstHost = prefix >= 31 ? network : network + 1;
  const lastHost = prefix >= 31 ? broadcast : Math.max(network, broadcast - 1);

  return {
    ip,
    prefix,
    mask: numberToIpv4(mask),
    network: numberToIpv4(network),
    broadcast: numberToIpv4(broadcast),
    firstHost: numberToIpv4(firstHost),
    lastHost: numberToIpv4(lastHost),
    totalAddresses: total,
    usableHosts: usable,
  };
}

export function prefixTable(ip: string, from = 8, to = 32): PrefixRow[] {
  const value = ipv4ToNumber(ip);
  const rows: PrefixRow[] = [];

  for (let prefix = from; prefix <= to; prefix++) {
    const mask = ipv4Mask(prefix);
    const network = (value & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    rows.push({
      prefix,
      mask: numberToIpv4(mask),
      network: numberToIpv4(network),
      broadcast: numberToIpv4(broadcast),
      usableHosts: usableHostCount(prefix),
    });
  }

  return rows;
}

export function expandIpv6(ip: string): string {
  const groups = parseIpv6(ip);
  if (!groups) throw new Error(`invalid ipv6 address: ${ip}`);
  return groups.map((group) => group.toString(16).padStart(4, "0")).join(":");
}

export function compressIpv6(ip: string): string {
  const groups = parseIpv6(ip);
  if (!groups) throw new Error(`invalid ipv6 address: ${ip}`);

  let bestStart = -1;
  let bestLength = 0;
  let runStart = -1;

  groups.forEach((group, index) => {
    if (group !== 0) {
      runStart = -1;
      return;
    }
    if (runStart < 0) runStart = index;
    const length = index - runStart + 1;
    if (length > bestLength) {
      bestStart = runStart;
      bestLength = length;
    }
  });

  const head = groups.slice(0, bestStart).map((group) => group.toString(16));
  const tail = groups.slice(bestStart + bestLength).map((group) => group.toString(16));

  if (bestLength < 2) return groups.map((group) => group.toString(16)).join(":");
  return `${head.join(":")}::${tail.join(":")}`;
}

export function toBinary(ip: string): string {
  const octets = parseIpv4(ip);
  if (octets) return octets.map((octet) => octet.toString(2).padStart(8, "0")).join("");

  const groups = parseIpv6(ip);
  if (!groups) throw new Error(`invalid ip address: ${ip}`);
  return groups.map((group) => group.toString(2).padStart(16, "0")).join("");
}

export function toHex(ip: string): string {
  const octets = parseIpv4(ip);
  if (octets) return octets.map((octet) => octet.toString(16).padStart(2, "0")).join("");

  const groups = parseIpv6(ip);
  if (!groups) throw new Error(`invalid ip address: ${ip}`);
  return groups.map((group) => group.toString(16).padStart(4, "0")).join("");
}

export function contains(cidr: string, ip: string): boolean {
  const trimmed = cidr.trim();
  const slash = trimmed.lastIndexOf("/");
  const networkText = slash >= 0 ? trimmed.slice(0, slash) : trimmed;
  const prefixText = slash >= 0 ? trimmed.slice(slash + 1) : null;

  const v4 = parseIpv4(networkText);
  if (v4) {
    const prefix = prefixText === null ? 32 : parsePrefixLength(prefixText, 32);
    if (prefix === null) return false;
    const target = parseIpv4(ip);
    if (!target) return false;
    const mask = ipv4Mask(prefix);
    return (ipv4ToNumber(networkText) & mask) >>> 0 === (ipv4ToNumber(ip) & mask) >>> 0;
  }

  const v6 = parseIpv6(networkText);
  if (v6) {
    const prefix = prefixText === null ? 128 : parsePrefixLength(prefixText, 128);
    if (prefix === null) return false;
    const target = parseIpv6(ip);
    if (!target) return false;
    const mask = ipv6Mask(prefix);
    return (ipv6Number(v6) & mask) === (ipv6Number(target) & mask);
  }

  return false;
}

function parsePrefixLength(raw: string, max: number): number | null {
  if (!/^\d{1,3}$/.test(raw)) return null;
  const value = Number(raw);
  return value <= max ? value : null;
}

function parseGroupList(text: string): number[] | null {
  if (text === "") return [];
  const groups: number[] = [];
  for (const chunk of text.split(":")) {
    if (!IPV6_GROUP.test(chunk)) return null;
    groups.push(Number.parseInt(chunk, 16));
  }
  return groups;
}

function assertIpv4Prefix(prefix: number): void {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new RangeError(`invalid ipv4 prefix: ${prefix}`);
  }
}

function ipv4Mask(prefix: number): number {
  assertIpv4Prefix(prefix);
  if (prefix === 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

function ipv6Mask(prefix: number): bigint {
  const host = 128 - prefix;
  return ((1n << 128n) - 1n) ^ ((1n << BigInt(host)) - 1n);
}

function ipv6Number(groups: number[]): bigint {
  return groups.reduce((acc, group) => (acc << 16n) | BigInt(group), 0n);
}
