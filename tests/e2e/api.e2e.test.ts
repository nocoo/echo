import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

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
  const server = spawn("bun", ["run", "src/index.ts"], {
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });

  beforeAll(async () => {
    await ensureAllDatabases();
    await waitForLive();
  });

  afterAll(() => {
    server.kill();
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

    type ProviderEntry = { name: string; location: unknown; error: boolean };
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
    expect(body.location!.countryCode).toBe("US");
  });
});
