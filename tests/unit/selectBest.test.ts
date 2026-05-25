import { describe, expect, test } from "vitest";
import { selectBest } from "../../src/services/selectBest.js";
import type { ProviderResult } from "../../src/services/cache.js";
import type { IpLocation } from "../../src/services/ipProvider.js";

function makeResult(name: string, location: Partial<IpLocation> | null): ProviderResult {
  return {
    name,
    attribution: `${name} attribution`,
    location: location ? {
      country: "",
      countryCode: "",
      province: "",
      city: "",
      latitude: null,
      longitude: null,
      isp: "",
      asn: null,
      asOrg: "",
      ...location,
    } : null,
    latencyMs: 5,
    error: false,
  };
}

describe("selectBest", () => {
  test("returns null when all results have null location", () => {
    const results = [
      makeResult("ip2region", null),
      makeResult("iplocate", null),
    ];
    expect(selectBest(results)).toBeNull();
  });

  test("prefers ip2region for Chinese IPs", () => {
    const results = [
      makeResult("ip2region", { country: "中国", countryCode: "CN", province: "江苏", city: "南京" }),
      makeResult("ip-location-db", { country: "China", countryCode: "CN", city: "Nanjing", latitude: 32.06, longitude: 118.79 }),
    ];

    const result = selectBest(results);
    expect(result?.source).toBe("ip2region");
    expect(result?.location.province).toBe("江苏");
  });

  test("prefers ip-location-db for non-Chinese IPs", () => {
    const results = [
      makeResult("ip2region", { country: "US", countryCode: "US", province: "CA", city: "LA" }),
      makeResult("ip-location-db", { country: "United States", countryCode: "US", city: "Los Angeles", latitude: 34.05, longitude: -118.24, asn: 15169, asOrg: "GOOGLE" }),
    ];

    const result = selectBest(results);
    expect(result?.source).toBe("ip-location-db");
    expect(result?.location.latitude).toBe(34.05);
  });

  test("enriches ASN from other providers when chosen lacks it", () => {
    const results = [
      makeResult("ip2region", { country: "中国", countryCode: "CN", city: "南京" }),
      makeResult("iplocate", { countryCode: "CN", asn: 4134, asOrg: "CHINANET" }),
    ];

    const result = selectBest(results);
    expect(result?.source).toBe("ip2region");
    expect(result?.location.asn).toBe(4134);
    expect(result?.location.asOrg).toBe("CHINANET");
  });

  test("does not overwrite existing ASN", () => {
    const results = [
      makeResult("ip-location-db", { country: "US", countryCode: "US", asn: 15169, asOrg: "GOOGLE" }),
      makeResult("circl", { countryCode: "US", asn: 99999, asOrg: "OTHER" }),
    ];

    const result = selectBest(results);
    expect(result?.location.asn).toBe(15169);
    expect(result?.location.asOrg).toBe("GOOGLE");
  });

  test("falls back to highest priority provider when ip-location-db not available", () => {
    const results = [
      makeResult("ip2region", { country: "Germany", countryCode: "DE", city: "Berlin" }),
      makeResult("circl", { countryCode: "DE", asn: 3320, asOrg: "DTAG" }),
    ];

    const result = selectBest(results);
    expect(result?.source).toBe("ip2region");
    expect(result?.location.asn).toBe(3320);
  });

  test("handles single valid result", () => {
    const results = [
      makeResult("ip2region", null),
      makeResult("circl", { countryCode: "JP", asn: 2516, asOrg: "KDDI" }),
    ];

    const result = selectBest(results);
    expect(result?.source).toBe("circl");
    expect(result?.location.countryCode).toBe("JP");
  });

  test("handles unknown provider name gracefully", () => {
    const results = [
      makeResult("unknown-provider", { country: "Test", countryCode: "XX" }),
      makeResult("another-unknown", { country: "Test2", countryCode: "YY" }),
    ];

    const result = selectBest(results);
    expect(result).not.toBeNull();
  });

  test("non-CN ip2region result falls back to ip-location-db", () => {
    const results = [
      makeResult("ip2region", { country: "US", countryCode: "US", province: "CA" }),
      makeResult("ip-location-db", { country: "United States", countryCode: "US", city: "LA", latitude: 34.0, longitude: -118.0 }),
      makeResult("circl", { countryCode: "US", asn: 7018, asOrg: "ATT" }),
    ];

    const result = selectBest(results);
    expect(result?.source).toBe("ip-location-db");
    expect(result?.location.asn).toBe(7018);
  });

  test("ASN-only ip-location-db does not win over ip2region with location", () => {
    const results = [
      makeResult("ip2region", { country: "United States", countryCode: "US", province: "California", city: "Mountain View" }),
      makeResult("ip-location-db", { asn: 15169, asOrg: "GOOGLE" }),
      makeResult("iplocate", { countryCode: "US", asn: 15169, asOrg: "GOOGLE" }),
    ];

    const result = selectBest(results);
    expect(result?.source).toBe("ip2region");
    expect(result?.location.city).toBe("Mountain View");
    expect(result?.location.asn).toBe(15169);
  });

  test("does not mutate the original provider result when enriching ASN", () => {
    const ip2regionResult = makeResult("ip2region", { country: "中国", countryCode: "CN", city: "南京" });
    const circlResult = makeResult("circl", { countryCode: "CN", asn: 4134, asOrg: "CHINANET" });
    const results = [ip2regionResult, circlResult];

    selectBest(results);

    expect(ip2regionResult.location!.asn).toBeNull();
    expect(ip2regionResult.location!.asOrg).toBe("");
  });
});
