import { describe, expect, test } from "bun:test";
import { lookupIp, parseRegion } from "../../src/services/ipLookup.js";
import { globalCache } from "../../src/services/ipdb.js";

describe("lookupIp", () => {
  test("returns null for invalid ip", async () => {
    const result = await lookupIp("not-an-ip");
    expect(result).toBeNull();
  });

  test("returns parsed info for ipv4", async () => {
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
    });
  });

  test("returns null location for empty region", async () => {
    globalCache.__ipdbCache = {
      v6: {
        client: {
          search: async () => "",
        },
        loadedAt: Date.now(),
      },
    };

    const result = await lookupIp("2001:db8::1");
    expect(result).toEqual({
      ip: "2001:db8::1",
      version: 6,
      location: { country: "", province: "", city: "", isp: "", iso2: "" },
    });
  });

  test("parseRegion handles missing fields", () => {
    expect(parseRegion("US|CA")).toEqual({
      country: "US",
      province: "CA",
      city: "",
      isp: "",
      iso2: "",
    });
  });
});
