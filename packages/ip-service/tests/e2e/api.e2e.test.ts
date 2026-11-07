import { type ChildProcessByStdio, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { access, mkdir, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

type ServerProcess = ChildProcessByStdio<null, Readable, Readable>;

const packageRoot = process.cwd();
const dataDir = path.join(packageRoot, "data");
const dashboardDir = path.resolve(packageRoot, "../dashboard/dist");

const requiredFiles = [
  "ip2region_v4.xdb",
  "ip2region_v6.xdb",
  "iplocate-asn.mmdb",
  "iplocate-country.mmdb",
  "ip-location-db-asn.mmdb",
  "ip-location-db-city.mmdb",
  "circl-country-asn.mmdb",
];

async function ensureAllDatabases(): Promise<void> {
  for (const file of requiredFiles) {
    await access(path.join(dataDir, file));
  }
}

async function linkDatabases(target: string): Promise<void> {
  for (const file of await readdir(dataDir)) {
    await symlink(path.join(dataDir, file), path.join(target, file));
  }
}

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
  await ensureAllDatabases();

  tempRoot = mkdtempSync(path.join(tmpdir(), "echo-e2e-"));
  const stateDir = path.join(tempRoot, "state");
  const spoolDir = path.join(tempRoot, "spool");
  const ipdbDir = path.join(tempRoot, "ipdb");
  await mkdir(stateDir, { recursive: true });
  await mkdir(spoolDir, { recursive: true });
  await mkdir(ipdbDir, { recursive: true });
  await linkDatabases(ipdbDir);

  const instanceId = randomUUID();
  server = spawn("bun", ["run", "src/index.ts"], {
    env: {
      ...process.env,
      PORT: "0",
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
  server?.kill();
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
