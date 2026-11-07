import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const baseUrl = "http://127.0.0.1:7010";
const liveUrl = `${baseUrl}/api/live`;

const dataDir = path.join(process.cwd(), "data");

const requiredFiles = [
  "ip2region_v4.xdb",
  "ip2region_v6.xdb",
  "iplocate-asn.mmdb",
  "iplocate-country.mmdb",
  "ip-location-db-asn.mmdb",
  "ip-location-db-city.mmdb",
  "circl-country-asn.mmdb",
];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLive(timeoutMs = 5_000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(liveUrl);
      if (res.ok) {
        return;
      }
    } catch {
      // ignore until server is up
    }

    await wait(200);
  }

  throw new Error("server did not start in time");
}

async function ensureAllDatabases() {
  for (const file of requiredFiles) {
    await access(path.join(dataDir, file));
  }
}

describe("api e2e", () => {
  const port = 7010;
  const stateDir = mkdtempSync(path.join(tmpdir(), "echo-e2e-state-"));
  const server = spawn("bun", ["run", "src/index.ts"], {
    env: { ...process.env, PORT: String(port), STATE_DIR: stateDir },
    stdio: "ignore",
  });

  beforeAll(async () => {
    await ensureAllDatabases();
    await waitForLive();
  });

  afterAll(async () => {
    server.kill();
    await rm(stateDir, { recursive: true, force: true });
  });

  test("live endpoint returns ok and version", async () => {
    const res = await fetch(liveUrl);

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.version).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  test("ip endpoint returns structured response with location", async () => {
    const res = await fetch(`${baseUrl}/api/ip`, {
      headers: {
        "x-forwarded-for": "1.2.3.4",
      },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      ip: "1.2.3.4",
      source: expect.any(String),
    });
    expect(body.source).not.toBe("");
    expect(body.location).not.toBeNull();
    expect(body).toHaveProperty("latencyMs");
    expect(body.attribution).toBeInstanceOf(Array);
    expect((body.attribution as string[]).length).toBeGreaterThan(0);
  });

  test("ip endpoint with detail=true returns all providers", async () => {
    const res = await fetch(`${baseUrl}/api/ip?detail=true`, {
      headers: {
        "x-forwarded-for": "1.2.3.4",
      },
    });

    expect(res.status).toBe(200);

    interface ProviderEntry {
      name: string;
      location: unknown;
      error: boolean;
    }
    const body = (await res.json()) as Record<string, unknown>;
    const providers = body.providers as ProviderEntry[];

    expect(providers).toBeInstanceOf(Array);
    expect(providers.length).toBe(4);

    const names = providers.map((p) => p.name);
    expect(names).toContain("ip2region");
    expect(names).toContain("iplocate");
    expect(names).toContain("ip-location-db");
    expect(names).toContain("circl");

    const successful = providers.filter((p) => !p.error && p.location !== null);
    expect(successful.length).toBeGreaterThan(0);
  });

  test("ip endpoint returns non-empty location fields for known IP", async () => {
    const res = await fetch(`${baseUrl}/api/ip`, {
      headers: {
        "x-forwarded-for": "8.8.8.8",
      },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { location: { countryCode: string } | null };
    expect(body.location).not.toBeNull();
    expect(body.location?.countryCode).toBe("US");
  });

  test("me endpoint reports an anonymous visitor", async () => {
    const res = await fetch(`${baseUrl}/api/me`);

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ authenticated: false, email: null });
  });

  test("admin endpoints reject anonymous access", async () => {
    const requests: [string, string][] = [
      ["GET", "/api/admin/overview"],
      ["GET", "/api/admin/keys"],
      ["GET", "/api/admin/refresh"],
      ["POST", "/api/admin/lookup"],
      ["POST", "/api/admin/keys"],
      ["POST", "/api/admin/keys/abc/revoke"],
    ];

    for (const [method, path] of requests) {
      const res = await fetch(`${baseUrl}${path}`, { method });
      expect(res.status, path).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
  });

  test("ip endpoint ignores an unknown api key", async () => {
    const res = await fetch(`${baseUrl}/api/ip?ip=8.8.8.8`, {
      headers: {
        "x-api-key": "echo_not-a-real-key",
        "x-forwarded-for": "1.2.3.4",
      },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ip).toBe("1.2.3.4");
  });
});
