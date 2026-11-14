import { type ChildProcessByStdio, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { writeFixtureDatabases } from "../fixtures/ipdb.js";

type ServerProcess = ChildProcessByStdio<null, Readable, Readable>;

const packageRoot = process.cwd();
const dashboardDir = path.resolve(packageRoot, "../dashboard/dist");

async function waitForInstance(
  server: ServerProcess,
  expectedInstance: string,
  timeoutMs = 20_000,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    let buffer = "";
    let stderr = "";

    const timer = setTimeout(() => {
      reject(new Error(`server did not report an instance in time: ${stderr}`));
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const match = /echo api instance=(\S+) port=(\d+)/.exec(buffer);
      if (!match) return;
      clearTimeout(timer);
      server.stdout.off("data", onData);
      if (match[1] !== expectedInstance) {
        reject(new Error(`unexpected instance ${match[1]}`));
        return;
      }
      resolve(Number(match[2]));
    };

    server.stdout.on("data", onData);
    server.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    server.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited with code ${code}: ${stderr}`));
    });
  });
}

let server: ServerProcess;
let tempRoot: string;
let baseUrl: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(path.join(tmpdir(), "echo-e2e-"));
  const stateDir = path.join(tempRoot, "state");
  const spoolDir = path.join(tempRoot, "spool");
  const ipdbDir = path.join(tempRoot, "ipdb");
  await mkdir(stateDir, { recursive: true });
  await mkdir(spoolDir, { recursive: true });
  await mkdir(ipdbDir, { recursive: true });
  await writeFixtureDatabases(ipdbDir);

  const instanceId = randomUUID();
  server = spawn("bun", ["run", "src/index.ts"], {
    env: {
      PATH: process.env.PATH,
      PORT: "0",
      DASHBOARD_DIR: dashboardDir,
      STATE_DIR: stateDir,
      SPOOL_DIR: spoolDir,
      IPDB_DIR: ipdbDir,
      INSTANCE_ID: instanceId,
    },
    stdio: ["ignore", "pipe", "pipe"],
  }) as ServerProcess;

  const port = await waitForInstance(server, instanceId);
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  if (server && server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill();
    await exited;
  }
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

describe("api e2e", () => {
  test("live endpoint returns ok and version", async () => {
    const res = await fetch(`${baseUrl}/api/live`);

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
    expect(successful).toHaveLength(4);
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

  test("unmatched fixture addresses never receive synthetic location records", async () => {
    const res = await fetch(`${baseUrl}/api/ip?detail=true`, {
      headers: { "x-forwarded-for": "192.0.2.1" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      providers: { name: string; location: unknown; error: boolean }[];
    };
    expect(body.providers).toHaveLength(4);
    expect(body.providers.every((provider) => !provider.error)).toBe(true);
    expect(body.providers.find((provider) => provider.name === "ip2region")?.location).toEqual({
      country: "",
      countryCode: "",
      province: "",
      city: "",
      latitude: null,
      longitude: null,
      isp: "",
      asn: null,
      asOrg: "",
    });
    expect(
      body.providers
        .filter((provider) => provider.name !== "ip2region")
        .map((provider) => provider.location),
    ).toEqual([null, null, null]);
  });

  test("IPv6 lookups use the isolated XDB fixture", async () => {
    const res = await fetch(`${baseUrl}/api/ip`, {
      headers: { "x-forwarded-for": "2001:db8::1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ip: "2001:db8::1",
      location: { countryCode: "US", city: "Fixture city" },
    });
  });

  test("root endpoint returns the json self description", async () => {
    const res = await fetch(`${baseUrl}/`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toMatchObject({ name: "echo", status: "ok" });
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

    for (const [method, route] of requests) {
      const res = await fetch(`${baseUrl}${route}`, { method });
      expect(res.status, route).toBe(401);
      expect(res.headers.get("content-type")).toContain("application/json");
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

describe("admin console assets", () => {
  test("serves the console shell", async () => {
    const res = await fetch(`${baseUrl}/admin`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain('<div id="root">');
  });

  test("serves a deep link with the console shell", async () => {
    const res = await fetch(`${baseUrl}/admin/tools`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  test("serves a built asset", async () => {
    const assets = await readdir(path.join(dashboardDir, "assets"));
    const asset = assets.find((name) => name.endsWith(".js") || name.endsWith(".css"));
    expect(asset).toBeDefined();

    const res = await fetch(`${baseUrl}/admin/assets/${asset}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript|css/);
  });

  test("answers unknown api paths with json", async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toMatchObject({ error: { code: "not_found" } });
  });
});
