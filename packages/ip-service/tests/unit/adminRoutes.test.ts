import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { AdminDeps, AdminEnv } from "../../src/admin/admin-routes.js";
import { registerAdminRoutes } from "../../src/admin/admin-routes.js";
import type { AuthConfig } from "../../src/admin/auth-config.js";
import { signSession } from "../../src/admin/session.js";
import { Store } from "../../src/lib/store.js";
import type { LookupResult } from "../../src/services/ipLookup.js";

const config: AuthConfig = {
  publicOrigin: "https://echo.example.com",
  clientId: "client-id",
  clientSecret: "client-secret",
  sessionSecret: "session-secret-long-enough-for-hs256-signing",
  allowedEmails: ["owner@example.com"],
};

const lookupResult: LookupResult = {
  ip: "8.8.8.8",
  version: 4,
  location: null,
  source: "ip2region",
  attribution: ["test"],
  latencyMs: 1,
};

let dataDir: string;
let store: Store;
let sessionCookie: string;

beforeEach(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "echo-admin-"));
  store = new Store(":memory:");
  const token = await signSession(
    { sub: "1234", email: "owner@example.com", name: "Owner", picture: null },
    config.sessionSecret,
  );
  sessionCookie = `echo_session=${token}`;
});

afterEach(() => {
  store.close();
  rmSync(dataDir, { recursive: true, force: true });
});

function createApp(overrides: Partial<AdminDeps> = {}) {
  const app = new Hono<AdminEnv>();
  registerAdminRoutes(app, {
    config,
    store: () => store,
    lookup: async () => lookupResult,
    dataDir,
    ...overrides,
  });
  return app;
}

describe("admin authentication", () => {
  test("rejects anonymous access to every admin route", async () => {
    const app = createApp();

    const requests: [string, string][] = [
      ["GET", "/api/admin/overview"],
      ["POST", "/api/admin/lookup"],
      ["GET", "/api/admin/keys"],
      ["POST", "/api/admin/keys"],
      ["POST", "/api/admin/keys/abc/revoke"],
      ["GET", "/api/admin/refresh"],
    ];

    for (const [method, route] of requests) {
      const res = await app.request(route, { method });
      expect(res.status, route).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
  });

  test("rejects a forged session cookie", async () => {
    const app = createApp();
    const res = await app.request("/api/admin/overview", {
      headers: { cookie: "echo_session=forged" },
    });

    expect(res.status).toBe(401);
  });

  test("rejects a session whose address left the allow list", async () => {
    const app = createApp();
    const token = await signSession(
      { sub: "1234", email: "removed@example.com", name: null, picture: null },
      config.sessionSecret,
    );

    const res = await app.request("/api/admin/keys", {
      headers: { cookie: `echo_session=${token}` },
    });

    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie().some((cookie) => cookie.startsWith("echo_session="))).toBe(
      true,
    );
  });
});

describe("GET /api/admin/overview", () => {
  test("returns the per-file inventory", async () => {
    writeFileSync(path.join(dataDir, "ip2region_v4.xdb"), "xdb");
    const app = createApp();

    const res = await app.request("/api/admin/overview", { headers: { cookie: sessionCookie } });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      databases: { filename: string; status: string }[];
      summary: { present: number; missing: number };
    };
    expect(body.databases.length).toBeGreaterThan(0);
    expect(body.databases.find((entry) => entry.filename === "ip2region_v4.xdb")?.status).toBe(
      "ok",
    );
    expect(body.summary.present).toBe(1);
  });
});

describe("POST /api/admin/lookup", () => {
  test("rejects a missing origin", async () => {
    const app = createApp();
    const res = await app.request("/api/admin/lookup", {
      method: "POST",
      headers: { cookie: sessionCookie, "content-type": "application/json" },
      body: JSON.stringify({ ip: "8.8.8.8" }),
    });

    expect(res.status).toBe(403);
  });

  test("rejects a foreign origin", async () => {
    const app = createApp();
    const res = await app.request("/api/admin/lookup", {
      method: "POST",
      headers: {
        cookie: sessionCookie,
        "content-type": "application/json",
        origin: "https://evil.example.com",
      },
      body: JSON.stringify({ ip: "8.8.8.8" }),
    });

    expect(res.status).toBe(403);
  });

  test("requires an ip", async () => {
    const app = createApp();
    const res = await app.request("/api/admin/lookup", {
      method: "POST",
      headers: {
        cookie: sessionCookie,
        "content-type": "application/json",
        origin: "https://echo.example.com",
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "invalid_request" } });
  });

  test("rejects an invalid ip", async () => {
    const app = createApp({ lookup: async () => null });
    const res = await app.request("/api/admin/lookup", {
      method: "POST",
      headers: {
        cookie: sessionCookie,
        "content-type": "application/json",
        origin: "https://echo.example.com",
      },
      body: JSON.stringify({ ip: "not-an-ip" }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "invalid_ip" } });
  });

  test("returns the detailed lookup result", async () => {
    const app = createApp();
    const res = await app.request("/api/admin/lookup", {
      method: "POST",
      headers: {
        cookie: sessionCookie,
        "content-type": "application/json",
        origin: "https://echo.example.com",
      },
      body: JSON.stringify({ ip: "8.8.8.8" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ip: "8.8.8.8", source: "ip2region" });
  });
});

describe("api key management", () => {
  test("lists keys without their plaintext", async () => {
    const created = store.createApiKey("ci key", "owner@example.com");
    const app = createApp();

    const res = await app.request("/api/admin/keys", { headers: { cookie: sessionCookie } });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { keys: { key_prefix: string }[] };
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0]?.key_prefix).toBe(created.apiKey.key_prefix);
    expect(JSON.stringify(body)).not.toContain(created.secret);
  });

  test("creates a key and returns the plaintext once", async () => {
    const app = createApp();

    const res = await app.request("/api/admin/keys", {
      method: "POST",
      headers: {
        cookie: sessionCookie,
        "content-type": "application/json",
        origin: "https://echo.example.com",
      },
      body: JSON.stringify({ name: "ci key" }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { apiKey: { created_by: string }; secret: string };
    expect(body.secret.startsWith("echo_")).toBe(true);
    expect(body.apiKey.created_by).toBe("owner@example.com");
  });

  test("rejects a missing name and a foreign origin", async () => {
    const app = createApp();

    const missingName = await app.request("/api/admin/keys", {
      method: "POST",
      headers: {
        cookie: sessionCookie,
        "content-type": "application/json",
        origin: "https://echo.example.com",
      },
      body: JSON.stringify({}),
    });
    expect(missingName.status).toBe(400);

    const foreignOrigin = await app.request("/api/admin/keys", {
      method: "POST",
      headers: {
        cookie: sessionCookie,
        "content-type": "application/json",
        origin: "https://evil.example.com",
      },
      body: JSON.stringify({ name: "ci key" }),
    });
    expect(foreignOrigin.status).toBe(403);
  });

  test("revokes a key once", async () => {
    const created = store.createApiKey("ci key", "owner@example.com");
    const app = createApp();

    const res = await app.request(`/api/admin/keys/${created.apiKey.id}/revoke`, {
      method: "POST",
      headers: { cookie: sessionCookie, origin: "https://echo.example.com" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: created.apiKey.id });

    const again = await app.request(`/api/admin/keys/${created.apiKey.id}/revoke`, {
      method: "POST",
      headers: { cookie: sessionCookie, origin: "https://echo.example.com" },
    });
    expect(again.status).toBe(404);
  });

  test("rejects a revoke without the matching origin", async () => {
    const created = store.createApiKey("ci key", "owner@example.com");
    const app = createApp();

    const res = await app.request(`/api/admin/keys/${created.apiKey.id}/revoke`, {
      method: "POST",
      headers: { cookie: sessionCookie },
    });

    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/refresh", () => {
  test("reports no refresh run", async () => {
    const app = createApp();
    const res = await app.request("/api/admin/refresh", { headers: { cookie: sessionCookie } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ current: null });
  });

  test("reports the latest refresh run", async () => {
    const run = store.createRefreshRun("owner@example.com");
    const app = createApp();

    const res = await app.request("/api/admin/refresh", { headers: { cookie: sessionCookie } });

    expect(await res.json()).toMatchObject({ current: { id: run.id, status: "requested" } });
  });
});
