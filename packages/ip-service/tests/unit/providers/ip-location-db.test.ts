import { beforeEach, describe, expect, test, vi } from "vitest";
import { IpLocationDbProvider } from "../../../src/services/providers/ip-location-db.js";
import { resetMmdbCache } from "../../../src/services/providers/mmdb.js";

const mockAsnData: Record<string, unknown> = {
  "1.2.3.4": {
    autonomous_system_number: 4134,
    autonomous_system_organization: "CHINANET-BACKBONE",
  },
};

const mockCityData: Record<string, unknown> = {
  "1.2.3.4": {
    country: { iso_code: "CN", names: { en: "China" } },
    subdivisions: [{ names: { en: "Jiangsu" } }],
    city: { names: { en: "Nanjing" } },
    location: { latitude: 32.06, longitude: 118.79 },
  },
};

vi.mock("maxmind", () => ({
  default: {
    open: vi.fn(async (filepath: string) => {
      if (filepath.includes("ip-location-db-asn")) {
        return { get: (ip: string) => mockAsnData[ip] ?? null };
      }
      if (filepath.includes("ip-location-db-city")) {
        return { get: (ip: string) => mockCityData[ip] ?? null };
      }
      return { get: () => null };
    }),
  },
}));

beforeEach(() => {
  resetMmdbCache();
});

describe("IpLocationDbProvider", () => {
  test("returns full city + ASN data", async () => {
    const provider = new IpLocationDbProvider();
    const result = await provider.lookup("1.2.3.4");

    expect(result).toEqual({
      country: "China",
      countryCode: "CN",
      province: "Jiangsu",
      city: "Nanjing",
      latitude: 32.06,
      longitude: 118.79,
      isp: "",
      asn: 4134,
      asOrg: "CHINANET-BACKBONE",
    });
  });

  test("returns null when no data found", async () => {
    const provider = new IpLocationDbProvider();
    const result = await provider.lookup("10.0.0.1");

    expect(result).toBeNull();
  });

  test("handles missing optional fields gracefully", async () => {
    mockCityData["8.8.8.8"] = {
      country: { iso_code: "US", names: { en: "United States" } },
    };
    mockAsnData["8.8.8.8"] = {
      autonomous_system_number: 15169,
      autonomous_system_organization: "GOOGLE",
    };

    const provider = new IpLocationDbProvider();
    const result = await provider.lookup("8.8.8.8");

    expect(result).toEqual({
      country: "United States",
      countryCode: "US",
      province: "",
      city: "",
      latitude: null,
      longitude: null,
      isp: "",
      asn: 15169,
      asOrg: "GOOGLE",
    });

    delete mockCityData["8.8.8.8"];
    delete mockAsnData["8.8.8.8"];
  });

  test("name and attribution are correct", () => {
    const provider = new IpLocationDbProvider();
    expect(provider.name).toBe("ip-location-db");
    expect(provider.attribution).toContain("sapics/ip-location-db");
  });

  test("handles city data only without ASN", async () => {
    mockCityData["9.9.9.9"] = {
      country: { iso_code: "DE", names: { en: "Germany" } },
      subdivisions: [{}],
      city: { names: { en: "Berlin" } },
      location: { latitude: 52.52, longitude: 13.4 },
    };

    const provider = new IpLocationDbProvider();
    const result = await provider.lookup("9.9.9.9");

    expect(result).toEqual({
      country: "Germany",
      countryCode: "DE",
      province: "",
      city: "Berlin",
      latitude: 52.52,
      longitude: 13.4,
      isp: "",
      asn: null,
      asOrg: "",
    });

    delete mockCityData["9.9.9.9"];
  });
});
