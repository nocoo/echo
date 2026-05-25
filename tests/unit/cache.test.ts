import { describe, expect, test, beforeEach } from "vitest";
import {
  getCached,
  setCached,
  resetCache,
  cacheSize,
  getRemainingTTL,
  CACHE_MAX,
  CACHE_TTL_MS,
} from "../../src/services/cache.js";
import type { CachedLookup } from "../../src/services/cache.js";

beforeEach(() => {
  resetCache();
});

const makeLookup = (country: string): CachedLookup => ({
  results: [{
    name: "test",
    attribution: "test",
    location: {
      country,
      countryCode: "XX",
      province: "",
      city: "",
      latitude: null,
      longitude: null,
      isp: "",
      asn: null,
      asOrg: "",
    },
    latencyMs: 1,
  }],
});

describe("LRU cache", () => {
  test("returns undefined on cache miss", () => {
    expect(getCached("1.2.3.4")).toBeUndefined();
  });

  test("returns cached value on hit", () => {
    const value = makeLookup("China");
    setCached("1.2.3.4", value);
    expect(getCached("1.2.3.4")).toEqual(value);
  });

  test("evicts oldest entries when max reached", () => {
    for (let i = 0; i < CACHE_MAX; i++) {
      setCached(`10.0.0.${i}`, makeLookup(`Country${i}`));
    }
    expect(cacheSize()).toBe(CACHE_MAX);

    setCached("10.0.1.0", makeLookup("Overflow"));
    expect(cacheSize()).toBe(CACHE_MAX);
    expect(getCached("10.0.0.0")).toBeUndefined();
    expect(getCached("10.0.1.0")).toBeDefined();
  });

  test("entries have TTL configured", () => {
    setCached("1.2.3.4", makeLookup("China"));
    const ttl = getRemainingTTL("1.2.3.4");
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(CACHE_TTL_MS + 100);
  });

  test("resetCache clears all entries", () => {
    setCached("1.2.3.4", makeLookup("China"));
    setCached("8.8.8.8", makeLookup("US"));
    expect(cacheSize()).toBe(2);

    resetCache();
    expect(cacheSize()).toBe(0);
  });

  test("CACHE_MAX is 100", () => {
    expect(CACHE_MAX).toBe(100);
  });

  test("CACHE_TTL_MS is 10 minutes", () => {
    expect(CACHE_TTL_MS).toBe(600_000);
  });
});
