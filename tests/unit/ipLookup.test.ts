import { describe, expect, test, beforeEach } from "vitest";
import { lookupIp, getProvider, resetProvider } from "../../src/services/ipLookup.js";
import { globalCache } from "../../src/services/ipdb.js";

beforeEach(() => {
  resetProvider();
});

describe("lookupIp", () => {
  test("returns null for invalid ip", async () => {
    const result = await lookupIp("not-an-ip");
    expect(result).toBeNull();
  });

  test("returns null for null input", async () => {
    const result = await lookupIp(null);
    expect(result).toBeNull();
  });

  test("returns parsed info for ipv4 with provider metadata", async () => {
    globalCache.__ipdbCache = {
      v4: {
        client: {
          search: async () => "中国|江苏省|南京市|电信|CN",
        },
        loadedAt: Date.now(),
      },
    };

    const result = await lookupIp("1.2.3.4");
    expect(result).toEqual({
      ip: "1.2.3.4",
      version: 4,
      location: {
        country: "中国",
        province: "江苏省",
        city: "南京市",
        isp: "电信",
        iso2: "CN",
      },
      source: "ip2region",
      attribution: expect.stringContaining("ip2region.net"),
    });
  });

  test("returns result for ipv6", async () => {
    globalCache.__ipdbCache = {
      v6: {
        client: {
          search: async () => "美国|||Google|US",
        },
        loadedAt: Date.now(),
      },
    };

    const result = await lookupIp("2001:db8::1");
    expect(result).toEqual({
      ip: "2001:db8::1",
      version: 6,
      location: {
        country: "美国",
        province: "",
        city: "",
        isp: "Google",
        iso2: "US",
      },
      source: "ip2region",
      attribution: expect.stringContaining("ip2region.net"),
    });
  });

  test("getProvider returns singleton", () => {
    const p1 = getProvider();
    const p2 = getProvider();
    expect(p1).toBe(p2);
  });

  test("resetProvider clears singleton", () => {
    const p1 = getProvider();
    resetProvider();
    const p2 = getProvider();
    expect(p1).not.toBe(p2);
  });
});
