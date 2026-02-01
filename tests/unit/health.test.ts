import { describe, expect, test } from "bun:test";
import { createApp } from "../../src/server.js";

describe("GET /health", () => {
  test("returns ok status", async () => {
    const app = createApp();
    const res = await app.request("/health");

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
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

  test("returns 200 for valid ip", async () => {
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
});
