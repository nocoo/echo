import { beforeEach, describe, expect, test, vi } from "vitest";
import { IplocateProvider } from "../../../src/services/providers/iplocate.js";
import { resetMmdbCache } from "../../../src/services/providers/mmdb.js";

const mockAsnData: Record<string, unknown> = {
  "1.2.3.4": {
    autonomous_system_number: 4134,
    autonomous_system_organization: "CHINANET-BACKBONE",
    country_code: "CN",
  },
};

const mockCountryData: Record<string, unknown> = {
  "1.2.3.4": {
    continent_code: "AS",
    country_code: "CN",
    country_name: "China",
  },
};

vi.mock("maxmind", () => ({
  default: {
    open: vi.fn(async (filepath: string) => {
      if (filepath.includes("iplocate-asn")) {
        return { get: (ip: string) => mockAsnData[ip] ?? null };
      }
      if (filepath.includes("iplocate-country")) {
        return { get: (ip: string) => mockCountryData[ip] ?? null };
      }
      return { get: () => null };
    }),
  },
}));

beforeEach(() => {
  resetMmdbCache();
});

describe("IplocateProvider", () => {
  test("returns combined ASN + country data", async () => {
    const provider = new IplocateProvider();
    const result = await provider.lookup("1.2.3.4");

    expect(result).toEqual({
      country: "China",
      countryCode: "CN",
      province: "",
      city: "",
      latitude: null,
      longitude: null,
      isp: "",
      asn: 4134,
      asOrg: "CHINANET-BACKBONE",
    });
  });

  test("returns null when no data found", async () => {
    const provider = new IplocateProvider();
    const result = await provider.lookup("10.0.0.1");

    expect(result).toBeNull();
  });

  test("handles partial data (ASN only)", async () => {
    mockCountryData["8.8.8.8"] = undefined;
    mockAsnData["8.8.8.8"] = {
      autonomous_system_number: 15169,
      autonomous_system_organization: "GOOGLE",
      country_code: "US",
    };

    const provider = new IplocateProvider();
    const result = await provider.lookup("8.8.8.8");

    expect(result).toEqual({
      country: "",
      countryCode: "US",
      province: "",
      city: "",
      latitude: null,
      longitude: null,
      isp: "",
      asn: 15169,
      asOrg: "GOOGLE",
    });

    delete mockAsnData["8.8.8.8"];
  });

  test("handles partial data (country only)", async () => {
    mockCountryData["9.9.9.9"] = {
      continent_code: "EU",
      country_code: "DE",
      country_name: "Germany",
    };

    const provider = new IplocateProvider();
    const result = await provider.lookup("9.9.9.9");

    expect(result).toEqual({
      country: "Germany",
      countryCode: "DE",
      province: "",
      city: "",
      latitude: null,
      longitude: null,
      isp: "",
      asn: null,
      asOrg: "",
    });

    delete mockCountryData["9.9.9.9"];
  });

  test("name and attribution are correct", () => {
    const provider = new IplocateProvider();
    expect(provider.name).toBe("iplocate");
    expect(provider.attribution).toContain("iplocate.io");
  });
});
