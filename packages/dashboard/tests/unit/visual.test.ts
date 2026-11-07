import { describe, expect, test } from "vitest";
import type { DatabaseEntry, IpLocation, ProviderResult } from "../../src/lib/api";
import {
  flagForCountry,
  freshnessRatio,
  latencyBucket,
  NEUTRAL_FLAG,
  providerAccent,
  providerFields,
  providerHit,
  statusTone,
  toneClasses,
  totalSizeBytes,
  truncateMiddle,
} from "../../src/lib/visual";

function location(overrides: Partial<IpLocation> = {}): IpLocation {
  return {
    country: "中国",
    countryCode: "CN",
    province: "北京",
    city: "大兴",
    latitude: null,
    longitude: null,
    isp: "移动",
    asn: 9808,
    asOrg: "China Mobile",
    ...overrides,
  };
}

function provider(overrides: Partial<ProviderResult> = {}): ProviderResult {
  return {
    name: "ip2region",
    attribution: "test",
    location: location(),
    latencyMs: 12,
    error: false,
    ...overrides,
  };
}

function database(overrides: Partial<DatabaseEntry> = {}): DatabaseEntry {
  return {
    filename: "ip2region_v4.xdb",
    provider: "ip2region",
    url: "https://example.com",
    present: true,
    size: 1024,
    modifiedAt: "2026-01-02T03:04:05.000Z",
    ageDays: 1,
    buildDate: null,
    status: "ok",
    ...overrides,
  };
}

describe("flagForCountry", () => {
  test("maps a country code to a regional indicator", () => {
    expect(flagForCountry("CN")).toBe("🇨🇳");
    expect(flagForCountry("us")).toBe("🇺🇸");
    expect(flagForCountry(" JP ")).toBe("🇯🇵");
  });

  test("falls back to a neutral flag", () => {
    expect(flagForCountry(null)).toBe(NEUTRAL_FLAG);
    expect(flagForCountry(undefined)).toBe(NEUTRAL_FLAG);
    expect(flagForCountry("")).toBe(NEUTRAL_FLAG);
    expect(flagForCountry("C")).toBe(NEUTRAL_FLAG);
    expect(flagForCountry("CHN")).toBe(NEUTRAL_FLAG);
    expect(flagForCountry("12")).toBe(NEUTRAL_FLAG);
  });
});

describe("truncateMiddle", () => {
  test("keeps short values", () => {
    expect(truncateMiddle("2001:db8::1", 12)).toBe("2001:db8::1");
  });

  test("truncates in the middle", () => {
    expect(truncateMiddle("2a0b:9900:0000:0000:0000:0000:0000:ec0b", 14)).toBe("2a0b:9900…ec0b");
    expect(truncateMiddle("2a0b:9900:0000:0000:0000:0000:0000:ec0b", 13)).toBe("2a0b:990…ec0b");
  });

  test("keeps a head only when the tail would be empty", () => {
    expect(truncateMiddle("abcdef", 3)).toBe("ab…");
  });

  test("refuses to truncate below the minimum", () => {
    expect(truncateMiddle("2001:db8::1", 2)).toBe("2001:db8::1");
    expect(truncateMiddle("2001:db8::1", 0)).toBe("2001:db8::1");
  });
});

describe("statusTone", () => {
  test("maps every status to a tone", () => {
    expect(statusTone("ok")).toBe("success");
    expect(statusTone("stale")).toBe("warning");
    expect(statusTone("missing")).toBe("destructive");
    expect(statusTone("error")).toBe("destructive");
    expect(statusTone("idle")).toBe("muted");
  });

  test("gives every tone token classes", () => {
    for (const tone of ["success", "warning", "destructive", "muted"] as const) {
      const classes = toneClasses(tone);
      expect(classes.dot).toContain("basalt");
      expect(classes.text).toContain("basalt");
    }
  });
});

describe("latencyBucket", () => {
  test("fills every dot below five milliseconds", () => {
    expect(latencyBucket(0)).toBe(10);
    expect(latencyBucket(4)).toBe(10);
    expect(latencyBucket(5)).toBe(10);
  });

  test("keeps one dot above two hundred milliseconds", () => {
    expect(latencyBucket(200)).toBe(1);
    expect(latencyBucket(2000)).toBe(1);
  });

  test("scales in between", () => {
    expect(latencyBucket(100)).toBe(6);
    expect(latencyBucket(50)).toBe(8);
  });

  test("treats an unknown latency as the worst case", () => {
    expect(latencyBucket(Number.NaN)).toBe(1);
  });
});

describe("providerAccent", () => {
  test("maps every provider to its chart colour", () => {
    expect(providerAccent("ip2region").text).toBe("text-basalt-chart-1");
    expect(providerAccent("iplocate").text).toBe("text-basalt-chart-2");
    expect(providerAccent("ip-location-db").text).toBe("text-basalt-chart-3");
    expect(providerAccent("circl").text).toBe("text-basalt-chart-4");
  });

  test("falls back to a muted accent", () => {
    expect(providerAccent("unknown").text).toBe("text-basalt-muted-foreground");
    expect(providerAccent("unknown").surface).toBe("bg-basalt-muted");
  });
});

describe("freshnessRatio", () => {
  test("scales against the seven day threshold", () => {
    expect(freshnessRatio(0)).toBe(1);
    expect(freshnessRatio(3.5)).toBe(0.5);
    expect(freshnessRatio(7)).toBe(0);
    expect(freshnessRatio(30)).toBe(0);
  });

  test("treats an unknown age as empty", () => {
    expect(freshnessRatio(null)).toBe(0);
    expect(freshnessRatio(Number.NaN)).toBe(0);
    expect(freshnessRatio(3, 0)).toBe(0);
  });
});

describe("totalSizeBytes", () => {
  test("sums the present files", () => {
    expect(totalSizeBytes([database({ size: 100 }), database({ size: null })])).toBe(100);
    expect(totalSizeBytes([])).toBe(0);
  });
});

describe("providerFields", () => {
  test("keeps only the fields the provider returned", () => {
    const fields = providerFields(location({ province: "", isp: "", asOrg: "", asn: null }));

    expect(fields).toEqual([
      { label: "国家", value: "中国" },
      { label: "城市", value: "大兴" },
    ]);
  });

  test("returns nothing without a location", () => {
    expect(providerFields(null)).toEqual([]);
  });
});

describe("providerHit", () => {
  test("treats a located provider as a hit", () => {
    expect(providerHit(provider())).toBe(true);
  });

  test("treats a failed provider as a miss", () => {
    expect(providerHit(provider({ error: true }))).toBe(false);
    expect(providerHit(provider({ location: null }))).toBe(false);
  });
});
