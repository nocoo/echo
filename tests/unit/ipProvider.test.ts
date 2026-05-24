import { describe, expect, test } from "vitest";
import type { IpProvider, IpLocation } from "../../src/services/ipProvider.js";

describe("IpProvider interface", () => {
  test("a compliant provider satisfies the interface contract", async () => {
    const mockProvider: IpProvider = {
      name: "mock",
      attribution: "Mock data",
      lookup: async (): Promise<IpLocation | null> => ({
        country: "US",
        province: "CA",
        city: "LA",
        isp: "Mock ISP",
        iso2: "US",
      }),
    };

    expect(mockProvider.name).toBe("mock");
    expect(mockProvider.attribution).toBe("Mock data");

    const result = await mockProvider.lookup("1.2.3.4");
    expect(result).toEqual({
      country: "US",
      province: "CA",
      city: "LA",
      isp: "Mock ISP",
      iso2: "US",
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
