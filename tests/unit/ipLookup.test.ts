import { describe, expect, test, beforeEach, vi } from "vitest";
import { lookupIp, getProviders, resetProviders } from "../../src/services/ipLookup.js";
import { globalCache } from "../../src/services/ipdb.js";
import { resetMmdbCache } from "../../src/services/providers/mmdb.js";

vi.mock("maxmind", () => ({
  default: {
    open: vi.fn(async () => ({
      get: () => null,
    })),
  },
}));

beforeEach(() => {
  resetProviders();
  resetMmdbCache();
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

  test("returns result with all provider data for ipv4", async () => {
    globalCache.__ipdbCache = {
      v4: {
        client: { search: async () => "中国|江苏省|南京市|电信|CN" },
        loadedAt: Date.now(),
      },
    };

    const result = await lookupIp("1.2.3.4");
    expect(result).not.toBeNull();
    expect(result!.ip).toBe("1.2.3.4");
    expect(result!.version).toBe(4);
    expect(result!.location).not.toBeNull();
    expect(result!.source).toBe("ip2region");
    expect(result!.attribution).toBeInstanceOf(Array);
    expect(typeof result!.latencyMs).toBe("number");
  });

  test("uses cache on second call", async () => {
    globalCache.__ipdbCache = {
      v4: {
        client: { search: async () => "中国|江苏省|南京市|电信|CN" },
        loadedAt: Date.now(),
      },
    };

    const result1 = await lookupIp("1.2.3.4");
    const result2 = await lookupIp("1.2.3.4");
    expect(result1!.location).toEqual(result2!.location);
  });

  test("detail mode includes providers array", async () => {
    globalCache.__ipdbCache = {
      v4: {
        client: { search: async () => "中国|江苏省|南京市|电信|CN" },
        loadedAt: Date.now(),
      },
    };

    const result = await lookupIp("1.2.3.4", true);
    expect(result).not.toBeNull();
    expect(result!.providers).toBeInstanceOf(Array);
    expect(result!.providers!.length).toBe(4);
    expect(result!.providers![0]!.name).toBe("ip2region");
  });

  test("non-detail mode does not include providers array", async () => {
    globalCache.__ipdbCache = {
      v4: {
        client: { search: async () => "中国|江苏省|南京市|电信|CN" },
        loadedAt: Date.now(),
      },
    };

    const result = await lookupIp("1.2.3.4", false);
    expect(result!.providers).toBeUndefined();
  });

  test("getProviders returns all 4 providers", () => {
    const providers = getProviders();
    expect(providers).toHaveLength(4);
    expect(providers.map((p) => p.name)).toEqual([
      "ip2region",
      "iplocate",
      "ip-location-db",
      "circl",
    ]);
  });

  test("resetProviders clears providers", () => {
    const p1 = getProviders();
    resetProviders();
    const p2 = getProviders();
    expect(p1).not.toBe(p2);
  });

  test("handles ipv6", async () => {
    globalCache.__ipdbCache = {
      v6: {
        client: { search: async () => "美国|||Google|US" },
        loadedAt: Date.now(),
      },
    };

    const result = await lookupIp("2001:db8::1");
    expect(result).not.toBeNull();
    expect(result!.ip).toBe("2001:db8::1");
    expect(result!.version).toBe(6);
  });

  test("handles provider errors gracefully", async () => {
    globalCache.__ipdbCache = {
      v4: {
        client: { search: async () => { throw new Error("boom"); } },
        loadedAt: Date.now(),
      },
    };

    // ip2region throws but MMDB providers return null (mocked) — not all errored
    const result = await lookupIp("1.2.3.4");
    expect(result).not.toBeNull();
    expect(result!.ip).toBe("1.2.3.4");
  });

  test("throws when all providers fail", async () => {
    globalCache.__ipdbCache = {
      v4: {
        client: { search: async () => { throw new Error("boom"); } },
        loadedAt: Date.now(),
      },
    };

    // Mock maxmind to throw for all MMDB providers
    const maxmind = await import("maxmind");
    vi.mocked(maxmind.default.open).mockRejectedValue(new Error("file not found"));

    await expect(lookupIp("1.2.3.4")).rejects.toThrow("all providers failed");
  });
});
