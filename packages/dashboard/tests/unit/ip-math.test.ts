import { describe, expect, test } from "vitest";
import {
  broadcastAddress,
  compressIpv6,
  contains,
  describeNetwork,
  expandIpv6,
  ipv4ToNumber,
  isIpv4,
  isIpv6,
  maskToPrefix,
  networkAddress,
  numberToIpv4,
  parseIpv4,
  parseIpv6,
  prefixTable,
  prefixToMask,
  toBinary,
  toHex,
  usableHostCount,
} from "../../src/lib/ip-math";

describe("parseIpv4", () => {
  test("parses dotted quads", () => {
    expect(parseIpv4("192.168.0.1")).toEqual([192, 168, 0, 1]);
    expect(parseIpv4("0.0.0.0")).toEqual([0, 0, 0, 0]);
    expect(parseIpv4("255.255.255.255")).toEqual([255, 255, 255, 255]);
  });

  test("rejects malformed input", () => {
    expect(parseIpv4("1.2.3")).toBeNull();
    expect(parseIpv4("1.2.3.4.5")).toBeNull();
    expect(parseIpv4("1.2.3.256")).toBeNull();
    expect(parseIpv4("1.2.3.a")).toBeNull();
    expect(parseIpv4("1.2.3.01")).toBeNull();
    expect(parseIpv4("1.2.3.-1")).toBeNull();
    expect(parseIpv4("")).toBeNull();
    expect(parseIpv4("1.2.3.4 ")).toEqual([1, 2, 3, 4]);
  });
});

describe("parseIpv6", () => {
  test("parses full and compressed forms", () => {
    expect(parseIpv6("2001:db8:0:0:0:0:0:1")).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]);
    expect(parseIpv6("2001:db8::1")).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]);
    expect(parseIpv6("::")).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(parseIpv6("::1")).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
  });

  test("parses embedded ipv4 tails", () => {
    expect(parseIpv6("::ffff:1.2.3.4")).toEqual([0, 0, 0, 0, 0, 0xffff, 0x102, 0x304]);
    expect(parseIpv6("::1.2.3.4")).toEqual([0, 0, 0, 0, 0, 0, 0x102, 0x304]);
    expect(parseIpv6("0:0:0:0:0:ffff:1.2.3.4")).toEqual([0, 0, 0, 0, 0, 0xffff, 0x102, 0x304]);
    expect(parseIpv6("2001:db8::1.2.3.4")).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0x102, 0x304]);
  });

  test("rejects malformed input", () => {
    expect(parseIpv6("")).toBeNull();
    expect(parseIpv6("1:2:3:4:5:6:7")).toBeNull();
    expect(parseIpv6("1:2:3:4:5:6:7:8:9")).toBeNull();
    expect(parseIpv6("1::2::3")).toBeNull();
    expect(parseIpv6("gggg::1")).toBeNull();
    expect(parseIpv6("12345::1")).toBeNull();
    expect(parseIpv6("1:2:3:4:5:6:7:")).toBeNull();
    expect(parseIpv6("1:2:3:4:5:6:7:8:")).toBeNull();
    expect(parseIpv6(":")).toBeNull();
    expect(parseIpv6("::::")).toBeNull();
    expect(parseIpv6("1:2:3:4:5:6:7:zzz")).toBeNull();
    expect(parseIpv6("1:2:3:4:5:6:7:8::")).toBeNull();
    expect(parseIpv6("::zzzz")).toBeNull();
    expect(parseIpv6("1:2:1.2.3.4")).toBeNull();
    expect(parseIpv6("::ffff:1.2.3.999")).toBeNull();
    expect(parseIpv6("no-colon")).toBeNull();
  });

  test("exposes family helpers", () => {
    expect(isIpv4("1.2.3.4")).toBe(true);
    expect(isIpv4("::1")).toBe(false);
    expect(isIpv6("::1")).toBe(true);
    expect(isIpv6("1.2.3.4")).toBe(false);
  });
});

describe("ipv4 conversion", () => {
  test("converts between numbers and dotted quads", () => {
    expect(ipv4ToNumber("0.0.0.0")).toBe(0);
    expect(ipv4ToNumber("255.255.255.255")).toBe(4294967295);
    expect(ipv4ToNumber("10.0.0.1")).toBe(167772161);
    expect(numberToIpv4(167772161)).toBe("10.0.0.1");
    expect(numberToIpv4(0)).toBe("0.0.0.0");
  });

  test("rejects invalid addresses", () => {
    expect(() => ipv4ToNumber("300.1.1.1")).toThrow(/invalid ipv4/);
  });
});

describe("cidr and netmask conversion", () => {
  test("converts prefix to dotted mask", () => {
    expect(prefixToMask(0)).toBe("0.0.0.0");
    expect(prefixToMask(8)).toBe("255.0.0.0");
    expect(prefixToMask(24)).toBe("255.255.255.0");
    expect(prefixToMask(32)).toBe("255.255.255.255");
  });

  test("rejects invalid prefixes", () => {
    expect(() => prefixToMask(33)).toThrow(RangeError);
    expect(() => prefixToMask(-1)).toThrow(RangeError);
    expect(() => prefixToMask(12.5)).toThrow(RangeError);
  });

  test("converts dotted mask to prefix", () => {
    expect(maskToPrefix("0.0.0.0")).toBe(0);
    expect(maskToPrefix("255.0.0.0")).toBe(8);
    expect(maskToPrefix("255.255.255.0")).toBe(24);
    expect(maskToPrefix("255.255.255.255")).toBe(32);
  });

  test("rejects non contiguous masks", () => {
    expect(maskToPrefix("255.0.255.0")).toBeNull();
    expect(maskToPrefix("255.255.255.1")).toBeNull();
    expect(maskToPrefix("not-a-mask")).toBeNull();
  });
});

describe("network arithmetic", () => {
  test("computes network and broadcast addresses", () => {
    expect(networkAddress("192.168.1.130", 24)).toBe("192.168.1.0");
    expect(broadcastAddress("192.168.1.130", 24)).toBe("192.168.1.255");
    expect(networkAddress("10.1.2.3", 8)).toBe("10.0.0.0");
    expect(broadcastAddress("10.1.2.3", 8)).toBe("10.255.255.255");
    expect(networkAddress("1.2.3.4", 32)).toBe("1.2.3.4");
    expect(broadcastAddress("1.2.3.4", 32)).toBe("1.2.3.4");
  });

  test("counts usable hosts", () => {
    expect(usableHostCount(24)).toBe(254);
    expect(usableHostCount(25)).toBe(126);
    expect(usableHostCount(8)).toBe(16777214);
    expect(usableHostCount(31)).toBe(2);
    expect(usableHostCount(32)).toBe(1);
    expect(() => usableHostCount(33)).toThrow(RangeError);
  });

  test("describes a network", () => {
    expect(describeNetwork("192.168.1.130", 24)).toEqual({
      ip: "192.168.1.130",
      prefix: 24,
      mask: "255.255.255.0",
      network: "192.168.1.0",
      broadcast: "192.168.1.255",
      firstHost: "192.168.1.1",
      lastHost: "192.168.1.254",
      totalAddresses: 256,
      usableHosts: 254,
    });

    expect(describeNetwork("192.168.1.130", 31)).toMatchObject({
      firstHost: "192.168.1.130",
      lastHost: "192.168.1.131",
      usableHosts: 2,
    });

    expect(describeNetwork("192.168.1.130", 32)).toMatchObject({
      firstHost: "192.168.1.130",
      lastHost: "192.168.1.130",
      usableHosts: 1,
    });
  });

  test("builds a per-prefix table", () => {
    const rows = prefixTable("192.168.1.130");

    expect(rows).toHaveLength(25);
    expect(rows[0]).toEqual({
      prefix: 8,
      mask: "255.0.0.0",
      network: "192.0.0.0",
      broadcast: "192.255.255.255",
      usableHosts: 16777214,
    });
    expect(rows.at(-1)).toEqual({
      prefix: 32,
      mask: "255.255.255.255",
      network: "192.168.1.130",
      broadcast: "192.168.1.130",
      usableHosts: 1,
    });
  });

  test("builds a per-prefix table for a custom range", () => {
    const rows = prefixTable("192.168.1.130", 24, 26);

    expect(rows.map((row) => row.prefix)).toEqual([24, 25, 26]);
    expect(rows[1]).toEqual({
      prefix: 25,
      mask: "255.255.255.128",
      network: "192.168.1.128",
      broadcast: "192.168.1.255",
      usableHosts: 126,
    });
  });
});

describe("ipv6 text forms", () => {
  test("expands to eight groups", () => {
    expect(expandIpv6("2001:db8::1")).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(expandIpv6("::")).toBe("0000:0000:0000:0000:0000:0000:0000:0000");
    expect(expandIpv6("::ffff:1.2.3.4")).toBe("0000:0000:0000:0000:0000:ffff:0102:0304");
  });

  test("accepts a trailing compression marker", () => {
    expect(expandIpv6("1::")).toBe("0001:0000:0000:0000:0000:0000:0000:0000");
    expect(compressIpv6("2001:db8::")).toBe("2001:db8::");
  });

  test("compresses zero runs", () => {
    expect(compressIpv6("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe("2001:db8::1");
    expect(compressIpv6("2001:db8:0:0:1:0:0:1")).toBe("2001:db8::1:0:0:1");
    expect(compressIpv6("1:2:3:4:5:6:7:8")).toBe("1:2:3:4:5:6:7:8");
    expect(compressIpv6("::")).toBe("::");
  });

  test("rejects invalid addresses", () => {
    expect(() => expandIpv6("nope")).toThrow(/invalid ipv6/);
    expect(() => compressIpv6("nope")).toThrow(/invalid ipv6/);
    expect(() => compressIpv6("1:2:3:4:5:6:7:8:")).toThrow(/invalid ipv6/);
  });
});

describe("binary and hex views", () => {
  test("renders ipv4", () => {
    expect(toBinary("0.0.0.0")).toBe("0".repeat(32));
    expect(toBinary("255.255.255.255")).toBe("1".repeat(32));
    expect(toHex("192.168.1.1")).toBe("c0a80101");
  });

  test("renders ipv6", () => {
    const hex = "0".repeat(31);
    const binary = "0".repeat(127);
    expect(toHex("::1")).toBe(`${hex}1`);
    expect(toBinary("::1")).toBe(`${binary}1`);
  });

  test("rejects invalid addresses", () => {
    expect(() => toBinary("nope")).toThrow(/invalid ip/);
    expect(() => toHex("nope")).toThrow(/invalid ip/);
  });
});

describe("containment", () => {
  test("checks ipv4 ranges", () => {
    expect(contains("10.0.0.0/8", "10.1.2.3")).toBe(true);
    expect(contains("10.0.0.0/8", "11.1.2.3")).toBe(false);
    expect(contains("192.168.1.0/24", "192.168.1.255")).toBe(true);
    expect(contains("192.168.1.0/24", "192.168.2.0")).toBe(false);
    expect(contains("1.2.3.4", "1.2.3.4")).toBe(true);
    expect(contains("1.2.3.4", "1.2.3.5")).toBe(false);
  });

  test("checks ipv6 ranges", () => {
    expect(contains("2001:db8::/32", "2001:db8:1234::1")).toBe(true);
    expect(contains("2001:db8::/32", "2001:db9::1")).toBe(false);
    expect(contains("::1", "::1")).toBe(true);
    expect(contains("::1", "::2")).toBe(false);
  });

  test("rejects invalid input", () => {
    expect(contains("10.0.0.0/33", "10.1.2.3")).toBe(false);
    expect(contains("10.0.0.0/abc", "10.1.2.3")).toBe(false);
    expect(contains("2001:db8::/129", "2001:db8::1")).toBe(false);
    expect(contains("garbage", "1.2.3.4")).toBe(false);
    expect(contains("10.0.0.0/8", "garbage")).toBe(false);
    expect(contains("10.0.0.0/8", "::1")).toBe(false);
    expect(contains("10.0.0.0/", "10.1.2.3")).toBe(false);
    expect(contains("10.0.0.0/0x8", "10.1.2.3")).toBe(false);
    expect(contains("2001:db8::/", "2001:db8::1")).toBe(false);
    expect(contains("2001:db8::/32", "garbage")).toBe(false);
  });
});
