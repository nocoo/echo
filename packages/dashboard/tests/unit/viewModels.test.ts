import { describe, expect, test } from "vitest";
import { buildKeysViewModel, loadKeys } from "../../src/app/keys/use-keys";
import { buildLookupViewModel, runLookup } from "../../src/app/lookup/use-lookup";
import { buildOverviewViewModel, loadOverview } from "../../src/app/overview/use-overview";
import {
  buildIpView,
  buildPrefixRows,
  convertCidr,
  evaluateContainment,
} from "../../src/app/tools/use-tools";
import type { ApiClient, ApiKey, LookupResponse, OverviewResponse } from "../../src/lib/api";

function apiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: "key-1",
    name: "ci",
    key_prefix: "echo_abcdefgh",
    status: "active",
    created_by: "owner@example.com",
    created_at: 1,
    last_used_at: null,
    revoked_at: null,
    ...overrides,
  };
}

function overview(overrides: Partial<OverviewResponse["summary"]> = {}): OverviewResponse {
  return {
    databases: [
      {
        filename: "ip2region_v4.xdb",
        provider: "ip2region",
        url: "https://example.com",
        present: true,
        size: 1024,
        modifiedAt: "2026-01-02T03:04:05.000Z",
        ageDays: 1,
        buildDate: null,
        status: "ok",
      },
    ],
    summary: { present: 1, missing: 0, ageDays: 1, stale: false, ...overrides },
  };
}

function lookupResponse(overrides: Partial<LookupResponse> = {}): LookupResponse {
  return {
    ip: "8.8.8.8",
    version: 4,
    location: null,
    source: "ip2region",
    attribution: ["ip2region"],
    latencyMs: 12,
    ...overrides,
  };
}

function stubClient(overrides: Partial<ApiClient>): ApiClient {
  return overrides as ApiClient;
}

describe("overview view model", () => {
  test("derives the counters", () => {
    const model = buildOverviewViewModel(overview(), [apiKey(), apiKey({ id: "key-2" })]);

    expect(model.stats).toEqual({
      ageDays: 1,
      status: "ok",
      databaseCount: 1,
      presentCount: 1,
      missingCount: 0,
      keyCount: 2,
    });
    expect(model.databases).toHaveLength(1);
  });

  test("marks stale data", () => {
    const model = buildOverviewViewModel(overview({ stale: true, ageDays: 12 }), []);
    expect(model.stats.status).toBe("stale");
  });

  test("marks unknown age", () => {
    const model = buildOverviewViewModel(overview({ ageDays: null, present: 0 }), []);
    expect(model.stats.status).toBe("unknown");
  });

  test("loads the overview and the keys together", async () => {
    const client = stubClient({
      overview: async () => overview(),
      listKeys: async () => [apiKey()],
    });

    const model = await loadOverview(client);
    expect(model.stats.keyCount).toBe(1);
  });
});

describe("lookup view model", () => {
  test("keeps the provider rows", () => {
    const model = buildLookupViewModel(
      lookupResponse({
        providers: [
          {
            name: "ip2region",
            attribution: "test",
            location: null,
            latencyMs: 3,
            error: false,
          },
        ],
      }),
    );

    expect(model.providers).toHaveLength(1);
    expect(model.source).toBe("ip2region");
  });

  test("defaults to an empty provider list", () => {
    const model = buildLookupViewModel(lookupResponse());
    expect(model.providers).toEqual([]);
  });

  test("runs a lookup", async () => {
    const client = stubClient({ lookup: async () => lookupResponse() });
    const model = await runLookup(client, "8.8.8.8");
    expect(model.ip).toBe("8.8.8.8");
  });
});

describe("keys view model", () => {
  test("counts active and revoked keys", () => {
    const model = buildKeysViewModel([apiKey(), apiKey({ id: "key-2", status: "revoked" })]);

    expect(model.activeCount).toBe(1);
    expect(model.revokedCount).toBe(1);
    expect(model.keys).toHaveLength(2);
  });

  test("loads the keys", async () => {
    const client = stubClient({ listKeys: async () => [apiKey()] });
    const model = await loadKeys(client);
    expect(model.keys).toHaveLength(1);
  });
});

describe("cidr conversion", () => {
  test("reads a prefix", () => {
    expect(convertCidr("24")).toEqual({ prefix: 24, mask: "255.255.255.0", error: null });
  });

  test("reads a mask", () => {
    expect(convertCidr("255.255.0.0")).toEqual({
      prefix: 16,
      mask: "255.255.0.0",
      error: null,
    });
  });

  test("reads a cidr", () => {
    expect(convertCidr("192.168.0.0/16")).toEqual({
      prefix: 16,
      mask: "255.255.0.0",
      error: null,
    });
  });

  test("rejects broken input", () => {
    expect(convertCidr("").error).toBeNull();
    expect(convertCidr("33").error).not.toBeNull();
    expect(convertCidr("192.168.1.1").error).not.toBeNull();
    expect(convertCidr("nonsense").error).not.toBeNull();
    expect(convertCidr("10.0.0.0/99").error).not.toBeNull();
  });

  test("rejects an invalid cidr address or prefix", () => {
    expect(convertCidr("bogus/24")).toEqual({
      prefix: null,
      mask: null,
      error: "CIDR 的地址部分必须是有效 IPv4",
    });
    expect(convertCidr("10.0.0.0/").error).not.toBeNull();
    expect(convertCidr("10.0.0.0/0x10").error).not.toBeNull();
    expect(convertCidr("10.0.0.0/1e2").error).not.toBeNull();
    expect(convertCidr("10.0.0.0/999").error).not.toBeNull();
  });
});

describe("prefix rows", () => {
  test("lists every prefix", () => {
    const { rows, error } = buildPrefixRows("192.168.1.130");
    expect(error).toBeNull();
    expect(rows).toHaveLength(25);
    expect(rows[0]?.network).toBe("192.0.0.0");
  });

  test("rejects a non ipv4 address", () => {
    expect(buildPrefixRows("::1").error).not.toBeNull();
  });

  test("ignores an empty address", () => {
    expect(buildPrefixRows("  ")).toEqual({ rows: [], error: null });
  });
});

describe("containment", () => {
  test("detects an address inside the range", () => {
    expect(evaluateContainment("10.0.0.0/8", "10.1.2.3")).toEqual({
      contains: true,
      error: null,
    });
  });

  test("detects an address outside the range", () => {
    expect(evaluateContainment("10.0.0.0/8", "11.1.2.3").contains).toBe(false);
  });

  test("waits for both inputs", () => {
    expect(evaluateContainment("10.0.0.0/8", "").contains).toBeNull();
  });

  test("rejects a broken address", () => {
    expect(evaluateContainment("10.0.0.0/8", "nonsense").error).not.toBeNull();
  });
});

describe("ip view", () => {
  test("renders an ipv4 address", () => {
    const view = buildIpView("192.168.1.1");
    expect(view.hex).toBe("c0a80101");
    expect(view.binary).toHaveLength(32);
    expect(view.expanded).toBeNull();
  });

  test("renders an ipv6 address", () => {
    const view = buildIpView("2001:db8::1");
    expect(view.expanded).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
    expect(view.compressed).toBe("2001:db8::1");
    expect(view.hex).toHaveLength(32);
  });

  test("reports an unparsable address", () => {
    expect(buildIpView("nonsense").error).not.toBeNull();
  });

  test("ignores an empty address", () => {
    expect(buildIpView("  ")).toEqual({
      ip: "",
      binary: "",
      hex: "",
      expanded: null,
      compressed: null,
      error: null,
    });
  });
});
