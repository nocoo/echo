import { describe, expect, test } from "bun:test";
import { extractClientIp, normalizeIp, parseClientIp } from "../../src/utils/ip";

describe("ip utils", () => {
  test("extracts ip from x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(extractClientIp(headers)).toBe("1.2.3.4");
  });

  test("extracts ip from x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(extractClientIp(headers)).toBe("9.9.9.9");
  });

  test("normalizes ipv6-mapped ipv4", () => {
    expect(normalizeIp("::ffff:1.2.3.4")).toBe("1.2.3.4");
  });

  test("parses ipv4", () => {
    expect(parseClientIp("1.2.3.4")).toEqual({ ip: "1.2.3.4", version: 4 });
  });

  test("parses ipv6", () => {
    const parsed = parseClientIp("2001:db8::1");
    expect(parsed).toEqual({ ip: "2001:db8::1", version: 6 });
  });

  test("returns null for invalid ip", () => {
    expect(parseClientIp("not-an-ip")).toBeNull();
  });

  test("returns null when no headers", () => {
    const headers = new Headers();
    expect(extractClientIp(headers)).toBeNull();
  });
});
