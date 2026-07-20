import { describe, expect, test } from "vitest";
import type { IpLocation, IpProvider } from "../../src/services/ipProvider.js";

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
