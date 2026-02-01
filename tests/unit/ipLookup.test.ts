import { describe, expect, test } from "bun:test";
import { lookupIp, parseRegion } from "../../src/services/ipLookup";
import { globalCache } from "../../src/services/ipdb";

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
