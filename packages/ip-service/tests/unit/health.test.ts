import { describe, expect, test } from "vitest";
import { version } from "../../src/lib/version.js";
import { createApp } from "../../src/server.js";

const testApiKey = "test-secret-key";

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
  test("returns surety-standard health response", async () => {
    const app = createApp();
    const res = await app.request("/api/live");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.version).toBe(version);
    expect(body.component).toBe("echo");
    expect(typeof body.timestamp).toBe("string");
    expect(new Date(body.timestamp as string).toISOString()).toBe(body.timestamp);
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
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
    const app = createApp(async (ip) => {
      receivedIp = ip;
      return {
        ip: ip ?? "",
        version: 4 as const,
        location: mockLocation,
        source: "ip2region",
        attribution: ["test"],
        latencyMs: 1,
      };
    }, testApiKey);

    const res = await app.request("/api/ip?ip=8.8.8.8", {
      headers: {
        "x-api-key": testApiKey,
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
    const app = createApp(async (ip) => {
      receivedIp = ip;
      return {
        ip: ip ?? "",
        version: 4 as const,
        location: mockLocation,
        source: "ip2region",
        attribution: ["test"],
        latencyMs: 1,
      };
    }, testApiKey);

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
    const app = createApp(async (ip) => {
      receivedIp = ip;
      return {
        ip: ip ?? "",
        version: 4 as const,
        location: mockLocation,
        source: "ip2region",
        attribution: ["test"],
        latencyMs: 1,
      };
    }, testApiKey);

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
    const app = createApp(async (ip) => {
      receivedIp = ip;
      return {
        ip: ip ?? "",
        version: 4 as const,
        location: mockLocation,
        source: "ip2region",
        attribution: ["test"],
        latencyMs: 1,
      };
    }, testApiKey);

    const res = await app.request("/api/ip", {
      headers: {
        "x-api-key": testApiKey,
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
    const app = createApp(async (ip) => {
      receivedIp = ip;
      return {
        ip: ip ?? "",
        version: 4 as const,
        location: mockLocation,
        source: "ip2region",
        attribution: ["test"],
        latencyMs: 1,
      };
    }, undefined);

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
});
