import { describe, expect, test, vi, beforeEach } from "vitest";
import { CirclProvider } from "../../../src/services/providers/circl.js";
import { resetMmdbCache } from "../../../src/services/providers/mmdb.js";

const mockData: Record<string, unknown> = {
  "1.2.3.4": {
    country: { iso_code: "CN" },
    autonomous_system_number: 4134,
    autonomous_system_organization: "CHINANET-BACKBONE",
  },
  "8.8.8.8": {
    country: { iso_code: "US" },
    autonomous_system_number: 15169,
    autonomous_system_organization: "GOOGLE",
  },
};

vi.mock("maxmind", () => ({
  default: {
    open: vi.fn(async () => ({
      get: (ip: string) => mockData[ip] ?? null,
    })),
  },
}));

beforeEach(() => {
  resetMmdbCache();
});

describe("CirclProvider", () => {
  test("returns country code + ASN data", async () => {
    const provider = new CirclProvider();
    const result = await provider.lookup("1.2.3.4");

    expect(result).toEqual({
      country: "",
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
    const provider = new CirclProvider();
    const result = await provider.lookup("10.0.0.1");

    expect(result).toBeNull();
  });

  test("handles record with only country", async () => {
    mockData["192.168.1.1"] = {
      country: { iso_code: "JP" },
    };

    const provider = new CirclProvider();
    const result = await provider.lookup("192.168.1.1");

    expect(result).toEqual({
      country: "",
      countryCode: "JP",
      province: "",
      city: "",
      latitude: null,
      longitude: null,
      isp: "",
      asn: null,
      asOrg: "",
    });

    delete mockData["192.168.1.1"];
  });

  test("handles record without country field", async () => {
    mockData["172.16.0.1"] = {
      autonomous_system_number: 1234,
      autonomous_system_organization: "TEST-NET",
    };

    const provider = new CirclProvider();
    const result = await provider.lookup("172.16.0.1");

    expect(result).toEqual({
      country: "",
      countryCode: "",
      province: "",
      city: "",
      latitude: null,
      longitude: null,
      isp: "",
      asn: 1234,
      asOrg: "TEST-NET",
    });

    delete mockData["172.16.0.1"];
  });

  test("name and attribution are correct", () => {
    const provider = new CirclProvider();
    expect(provider.name).toBe("circl");
    expect(provider.attribution).toContain("circl.lu");
  });
});
