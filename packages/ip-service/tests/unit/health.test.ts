import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Store } from "../../src/lib/store.js";
import { version } from "../../src/lib/version.js";
import { createApp } from "../../src/server.js";

function createStoreWithKey(): { store: Store; secret: string } {
  const store = new Store(":memory:");
  const created = store.createApiKey("test key", "tester");
  return { store, secret: created.secret };
}

const mockLocation = {
  country: "CN",
  countryCode: "CN",
  province: "JS",
  city: "NJ",
  latitude: null,
  longitude: null,
  isp: "ISP",
  asn: null,
  asOrg: "",
};

describe("GET /api/live", () => {
  const fresh = async () => ({ ageDays: 0, stale: false });
  const lookupOk = async () => ({
    ip: "1.1.1.1",
    version: 4 as const,
    location: mockLocation,
    source: "ip2region",
    attribution: ["test"],
    latencyMs: 1,
  });

  beforeEach(() => {
    vi.useRealTimers();
  });

  test("returns surety-standard health response", async () => {
    const app = createApp(lookupOk, { dataAge: fresh });
    const res = await app.request("/api/live");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.version).toBe(version);
    expect(body.component).toBe("echo");
    expect(body.database).toEqual({ connected: true, ageDays: 0 });
    expect(typeof body.timestamp).toBe("string");
    expect(new Date(body.timestamp as string).toISOString()).toBe(body.timestamp);
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(body)).not.toContain("refreshedAt");
  });

  test("reports outdated instead of ok once the data is older than a week", async () => {
    const app = createApp(lookupOk, { dataAge: async () => ({ ageDays: 12, stale: true }) });
    const res = await app.request("/api/live");

    expect(res.status).toBe(503);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      status: "outdated",
      database: { connected: true, ageDays: 12 },
    });
  });

  test("reports error when the data age cannot be determined", async () => {
    const app = createApp(lookupOk, { dataAge: async () => null });
    const res = await app.request("/api/live");

    expect(res.status).toBe(503);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      status: "error",
      database: { connected: true, ageDays: null },
    });
  });

  test("returns uncached 503 when the IP databases cannot serve a query", async () => {
    for (const lookup of [
      async () => null,
      async () => {
        throw new Error("private-database-path");
      },
    ]) {
      const res = await createApp(lookup, { dataAge: fresh }).request("/api/live");
      expect(res.status).toBe(503);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const body = await res.json();
      expect(body).toMatchObject({
        status: "error",
        version,
        database: { connected: false },
      });
      expect(JSON.stringify(body)).not.toContain("private-database-path");
    }
  });
});

describe("GET /", () => {
  test("returns service info with updated endpoints", async () => {
    const app = createApp();
    const res = await app.request("/");

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      name: "echo",
      status: "ok",
      endpoints: ["/api/live", "/api/ip"],
    });
  });
});

describe("GET /api/ip", () => {
  test("returns 400 for invalid ip", async () => {
    const app = createApp(async () => null);
    const res = await app.request("/api/ip");

    expect(res.status).toBe(400);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      error: { code: "invalid_ip" },
    });
  });

  test("returns 200 for valid ip from header", async () => {
    const app = createApp(async () => ({
      ip: "1.2.3.4",
      version: 4,
      location: mockLocation,
      source: "ip2region",
      attribution: ["test attribution"],
      latencyMs: 1,
    }));

    const res = await app.request("/api/ip", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      ip: "1.2.3.4",
      version: 4,
      source: "ip2region",
    });
    expect(body.attribution).toBeInstanceOf(Array);
  });

  test("returns 500 when lookup throws", async () => {
    const app = createApp(async () => {
      throw new Error("boom");
    });

    const res = await app.request("/api/ip");

    expect(res.status).toBe(500);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      error: { code: "lookup_failed" },
    });
  });

  test("uses query ip when authenticated with valid api key", async () => {
    let receivedIp: string | null = null;
    const { store, secret } = createStoreWithKey();
    const app = createApp(
      async (ip) => {
        receivedIp = ip;
        return {
          ip: ip ?? "",
          version: 4 as const,
          location: mockLocation,
          source: "ip2region",
          attribution: ["test"],
          latencyMs: 1,
        };
      },
      { store },
    );

    const res = await app.request("/api/ip?ip=8.8.8.8", {
      headers: {
        "x-api-key": secret,
        "x-forwarded-for": "1.2.3.4",
      },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ip).toBe("8.8.8.8");
    expect(receivedIp).toBe("8.8.8.8");
  });

  test("ignores query ip when api key is missing", async () => {
    let receivedIp: string | null = null;
    const { store } = createStoreWithKey();
    const app = createApp(
      async (ip) => {
        receivedIp = ip;
        return {
          ip: ip ?? "",
          version: 4 as const,
          location: mockLocation,
          source: "ip2region",
          attribution: ["test"],
          latencyMs: 1,
        };
      },
      { store },
    );

    const res = await app.request("/api/ip?ip=8.8.8.8", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ip).toBe("1.2.3.4");
    expect(receivedIp).toBe("1.2.3.4");
  });

  test("ignores query ip when api key is wrong", async () => {
    let receivedIp: string | null = null;
    const { store } = createStoreWithKey();
    const app = createApp(
      async (ip) => {
        receivedIp = ip;
        return {
          ip: ip ?? "",
          version: 4 as const,
          location: mockLocation,
          source: "ip2region",
          attribution: ["test"],
          latencyMs: 1,
        };
      },
      { store },
    );

    const res = await app.request("/api/ip?ip=8.8.8.8", {
      headers: {
        "x-api-key": "wrong-key",
        "x-forwarded-for": "1.2.3.4",
      },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ip).toBe("1.2.3.4");
    expect(receivedIp).toBe("1.2.3.4");
  });

  test("falls back to source ip when authenticated but no query ip", async () => {
    let receivedIp: string | null = null;
    const { store, secret } = createStoreWithKey();
    const app = createApp(
      async (ip) => {
        receivedIp = ip;
        return {
          ip: ip ?? "",
          version: 4 as const,
          location: mockLocation,
          source: "ip2region",
          attribution: ["test"],
          latencyMs: 1,
        };
      },
      { store },
    );

    const res = await app.request("/api/ip", {
      headers: {
        "x-api-key": secret,
        "x-forwarded-for": "1.2.3.4",
      },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ip).toBe("1.2.3.4");
    expect(receivedIp).toBe("1.2.3.4");
  });

  test("ignores query ip when no api key is configured on server", async () => {
    let receivedIp: string | null = null;
    const app = createApp(
      async (ip) => {
        receivedIp = ip;
        return {
          ip: ip ?? "",
          version: 4 as const,
          location: mockLocation,
          source: "ip2region",
          attribution: ["test"],
          latencyMs: 1,
        };
      },
      { store: new Store(":memory:") },
    );

    const res = await app.request("/api/ip?ip=8.8.8.8", {
      headers: {
        "x-api-key": "some-key",
        "x-forwarded-for": "1.2.3.4",
      },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ip).toBe("1.2.3.4");
    expect(receivedIp).toBe("1.2.3.4");
  });

  test("returns providers array when detail=true", async () => {
    const providers = [
      {
        name: "ip2region",
        attribution: "test",
        location: mockLocation,
        latencyMs: 1,
        error: false,
      },
      { name: "iplocate", attribution: "test2", location: null, latencyMs: 2, error: false },
    ];

    const app = createApp(async () => ({
      ip: "1.2.3.4",
      version: 4 as const,
      location: mockLocation,
      source: "ip2region",
      attribution: ["test"],
      latencyMs: 1,
      providers,
    }));

    const res = await app.request("/api/ip?detail=true", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.providers).toBeInstanceOf(Array);
    expect((body.providers as unknown[]).length).toBe(2);
  });

  test("does not include providers when detail is not true", async () => {
    const app = createApp(async () => ({
      ip: "1.2.3.4",
      version: 4 as const,
      location: mockLocation,
      source: "ip2region",
      attribution: ["test"],
      latencyMs: 1,
    }));

    const res = await app.request("/api/ip", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.providers).toBeUndefined();
  });

  test("verifies api keys against the state directory store", async () => {
    const stateDir = mkdtempSync(path.join(tmpdir(), "echo-state-"));
    const previous = process.env.STATE_DIR;
    process.env.STATE_DIR = stateDir;

    try {
      const store = new Store(path.join(stateDir, "echo.db"));
      const created = store.createApiKey("state key", "owner@example.com");
      store.close();

      const app = createApp(async (ip) => ({
        ip: ip ?? "",
        version: 4 as const,
        location: mockLocation,
        source: "ip2region",
        attribution: ["test"],
        latencyMs: 1,
      }));

      const res = await app.request("/api/ip?ip=8.8.8.8", {
        headers: {
          "x-api-key": created.secret,
          "x-forwarded-for": "1.2.3.4",
        },
      });

      const body = (await res.json()) as Record<string, unknown>;
      expect(body.ip).toBe("8.8.8.8");
    } finally {
      if (previous === undefined) delete process.env.STATE_DIR;
      else process.env.STATE_DIR = previous;
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  test("falls back to the requester ip when the state store cannot be opened", async () => {
    const previous = process.env.STATE_DIR;
    process.env.STATE_DIR = "/dev/null/echo-state";

    try {
      const app = createApp(async (ip) => ({
        ip: ip ?? "",
        version: 4 as const,
        location: mockLocation,
        source: "ip2region",
        attribution: ["test"],
        latencyMs: 1,
      }));

      const res = await app.request("/api/ip?ip=8.8.8.8", {
        headers: {
          "x-api-key": "echo_some-key",
          "x-forwarded-for": "1.2.3.4",
        },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.ip).toBe("1.2.3.4");
    } finally {
      if (previous === undefined) delete process.env.STATE_DIR;
      else process.env.STATE_DIR = previous;
    }
  });
});
