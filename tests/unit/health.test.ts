import { describe, expect, test } from "bun:test";
import app from "../../src/server";

describe("GET /health", () => {
  test("returns ok status", async () => {
    const res = await app.request("/health");

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});

describe("GET /api/ip", () => {
  test("returns 400 for invalid ip", async () => {
    const res = await app.request("/api/ip");

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toMatchObject({
      error: { code: "invalid_ip" },
      source: "ip2region",
    });
  });
});
