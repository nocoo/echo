import { describe, expect, test } from "vitest";
import {
  Ip2RegionProvider,
  parseRegion,
} from "../../../src/services/providers/ip2region.js";
import { globalCache } from "../../../src/services/ipdb.js";

describe("Ip2RegionProvider", () => {
  test("lookup resolves IPv4 using v4 client", async () => {
    globalCache.__ipdbCache = {
      v4: {
        client: { search: async () => "中国|江苏省|南京市|电信|CN" },
        loadedAt: Date.now(),
      },
    };

    const provider = new Ip2RegionProvider();
    const result = await provider.lookup("1.2.3.4");

    expect(result).toEqual({
      country: "中国",
      province: "江苏省",
      city: "南京市",
      isp: "电信",
      iso2: "CN",
    });
  });

  test("lookup resolves IPv6 using v6 client", async () => {
    globalCache.__ipdbCache = {
      v6: {
        client: { search: async () => "美国|加利福尼亚|洛杉矶|Google|US" },
        loadedAt: Date.now(),
      },
    };

    const provider = new Ip2RegionProvider();
    const result = await provider.lookup("2001:db8::1");

    expect(result).toEqual({
      country: "美国",
      province: "加利福尼亚",
      city: "洛杉矶",
      isp: "Google",
      iso2: "US",
    });
  });

  test("name and attribution are correct", () => {
    const provider = new Ip2RegionProvider();
    expect(provider.name).toBe("ip2region");
    expect(provider.attribution).toContain("ip2region.net");
  });
});

describe("parseRegion", () => {
  test("parses full region string", () => {
    expect(parseRegion("中国|江苏省|南京市|电信|CN")).toEqual({
      country: "中国",
      province: "江苏省",
      city: "南京市",
      isp: "电信",
      iso2: "CN",
    });
  });

  test("handles missing fields", () => {
    expect(parseRegion("US|CA")).toEqual({
      country: "US",
      province: "CA",
      city: "",
      isp: "",
      iso2: "",
    });
  });

  test("handles empty string", () => {
    expect(parseRegion("")).toEqual({
      country: "",
      province: "",
      city: "",
      isp: "",
      iso2: "",
    });
  });

  test("handles all fields empty", () => {
    expect(parseRegion("||||")).toEqual({
      country: "",
      province: "",
      city: "",
      isp: "",
      iso2: "",
    });
  });
});
