import { describe, expect, test, vi } from "vitest";
import type { IpProvider, IpLocation } from "../../src/services/ipProvider.js";
import { createProvider } from "../../src/services/ipProvider.js";
import { Ip2RegionProvider } from "../../src/services/providers/ip2region.js";

describe("IpProvider interface", () => {
  test("a compliant provider satisfies the interface contract", async () => {
    const mockProvider: IpProvider = {
      name: "mock",
      attribution: "Mock data",
      lookup: async (): Promise<IpLocation | null> => ({
        country: "US",
        countryCode: "US",
        province: "CA",
        city: "LA",
        latitude: 34.05,
        longitude: -118.24,
        isp: "Mock ISP",
        asn: 12345,
        asOrg: "Mock Org",
      }),
    };

    expect(mockProvider.name).toBe("mock");
    expect(mockProvider.attribution).toBe("Mock data");

    const result = await mockProvider.lookup("1.2.3.4");
    expect(result).toEqual({
      country: "US",
      countryCode: "US",
      province: "CA",
      city: "LA",
      latitude: 34.05,
      longitude: -118.24,
      isp: "Mock ISP",
      asn: 12345,
      asOrg: "Mock Org",
    });
  });

  test("provider can return null for unknown IPs", async () => {
    const mockProvider: IpProvider = {
      name: "mock",
      attribution: "Mock data",
      lookup: async () => null,
    };

    const result = await mockProvider.lookup("0.0.0.0");
    expect(result).toBeNull();
  });
});

describe("createProvider", () => {
  test("returns Ip2RegionProvider by default", () => {
    const provider = createProvider();
    expect(provider).toBeInstanceOf(Ip2RegionProvider);
    expect(provider.name).toBe("ip2region");
  });

  test("returns Ip2RegionProvider when explicitly named", () => {
    const provider = createProvider("ip2region");
    expect(provider).toBeInstanceOf(Ip2RegionProvider);
  });

  test("respects IP_PROVIDER env var", () => {
    vi.stubEnv("IP_PROVIDER", "ip2region");
    const provider = createProvider();
    expect(provider).toBeInstanceOf(Ip2RegionProvider);
    vi.unstubAllEnvs();
  });

  test("throws for unknown provider name", () => {
    expect(() => createProvider("nonexistent")).toThrow(
      "Unknown IP provider: nonexistent",
    );
  });

  test("explicit name takes precedence over env var", () => {
    vi.stubEnv("IP_PROVIDER", "nonexistent");
    const provider = createProvider("ip2region");
    expect(provider).toBeInstanceOf(Ip2RegionProvider);
    vi.unstubAllEnvs();
  });
});
