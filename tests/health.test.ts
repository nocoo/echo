import { describe, expect, test } from "bun:test";
import app from "../src/server";

describe("GET /health", () => {
  test("returns ok status", async () => {
    const res = await app.request("/health");

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});
