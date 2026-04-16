import { describe, expect, test } from "bun:test";
import { createApp } from "../../src/server.js";
import { version } from "../../src/lib/version.js";

const testApiKey = "test-secret-key";

describe("GET /api/live", () => {
  test("returns surety-standard health response", async () => {
    const app = createApp();
    const res = await app.request("/api/live");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBe(version);
    expect(body.component).toBe("echo");
    expect(typeof body.timestamp).toBe("string");
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });
});

describe("GET /", () => {
  test("returns service info with updated endpoints", async () => {
    const app = createApp();
    const res = await app.request("/");

    expect(res.status).toBe(200);

    const body = await res.json();
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

    const body = await res.json();
    expect(body).toMatchObject({
      error: { code: "invalid_ip" },
      source: "ip2region",
    });
  });

  test("returns 200 for valid ip from header", async () => {
    const app = createApp(async () => ({
      ip: "1.2.3.4",
      version: 4,
      location: { country: "CN", province: "JS", city: "NJ", isp: "ISP", iso2: "CN" },
    }));

    const res = await app.request("/api/ip", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
      },
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      ip: "1.2.3.4",
      version: 4,
      source: "ip2region",
    });
  });

  test("returns 500 when lookup throws", async () => {
    const app = createApp(async () => {
      throw new Error("boom");
    });

    const res = await app.request("/api/ip");

    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body).toMatchObject({
      error: { code: "lookup_failed" },
      source: "ip2region",
    });
  });

  test("uses query ip when authenticated with valid api key", async () => {
    let receivedIp: string | null = null;
    const app = createApp(async (ip) => {
      receivedIp = ip;
      return {
        ip: ip!,
        version: 4 as const,
        location: { country: "US", province: "CA", city: "LA", isp: "ISP", iso2: "US" },
      };
    }, testApiKey);

    const res = await app.request("/api/ip?ip=8.8.8.8", {
      headers: {
        "x-api-key": testApiKey,
        "x-forwarded-for": "1.2.3.4",
      },
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ip).toBe("8.8.8.8");
    expect(receivedIp).toBe("8.8.8.8");
  });

  test("ignores query ip when api key is missing", async () => {
    let receivedIp: string | null = null;
    const app = createApp(async (ip) => {
      receivedIp = ip;
      return {
        ip: ip!,
        version: 4 as const,
        location: { country: "CN", province: "JS", city: "NJ", isp: "ISP", iso2: "CN" },
      };
    }, testApiKey);

    const res = await app.request("/api/ip?ip=8.8.8.8", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
      },
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ip).toBe("1.2.3.4");
    expect(receivedIp).toBe("1.2.3.4");
  });

  test("ignores query ip when api key is wrong", async () => {
    let receivedIp: string | null = null;
    const app = createApp(async (ip) => {
      receivedIp = ip;
      return {
        ip: ip!,
        version: 4 as const,
        location: { country: "CN", province: "JS", city: "NJ", isp: "ISP", iso2: "CN" },
      };
    }, testApiKey);

    const res = await app.request("/api/ip?ip=8.8.8.8", {
      headers: {
        "x-api-key": "wrong-key",
        "x-forwarded-for": "1.2.3.4",
      },
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ip).toBe("1.2.3.4");
    expect(receivedIp).toBe("1.2.3.4");
  });

  test("falls back to source ip when authenticated but no query ip", async () => {
    let receivedIp: string | null = null;
    const app = createApp(async (ip) => {
      receivedIp = ip;
      return {
        ip: ip!,
        version: 4 as const,
        location: { country: "CN", province: "JS", city: "NJ", isp: "ISP", iso2: "CN" },
      };
    }, testApiKey);

    const res = await app.request("/api/ip", {
      headers: {
        "x-api-key": testApiKey,
        "x-forwarded-for": "1.2.3.4",
      },
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ip).toBe("1.2.3.4");
    expect(receivedIp).toBe("1.2.3.4");
  });

  test("ignores query ip when no api key is configured on server", async () => {
    let receivedIp: string | null = null;
    const app = createApp(async (ip) => {
      receivedIp = ip;
      return {
        ip: ip!,
        version: 4 as const,
        location: { country: "CN", province: "JS", city: "NJ", isp: "ISP", iso2: "CN" },
      };
    }, undefined);

    const res = await app.request("/api/ip?ip=8.8.8.8", {
      headers: {
        "x-api-key": "some-key",
        "x-forwarded-for": "1.2.3.4",
      },
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ip).toBe("1.2.3.4");
    expect(receivedIp).toBe("1.2.3.4");
  });
});
