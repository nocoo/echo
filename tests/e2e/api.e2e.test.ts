import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

const baseUrl = "http://127.0.0.1:7012";
const healthUrl = `${baseUrl}/health`;

const dataDir = path.join(process.cwd(), "data");
const v4Path = path.join(dataDir, "ip2region_v4.xdb");
const v6Path = path.join(dataDir, "ip2region_v6.xdb");

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(timeoutMs = 5_000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(healthUrl);
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

async function ensureIpdb() {
  await access(v4Path);
  await access(v6Path);
}

describe("api e2e", () => {
  const port = 7012;
  const server = spawn("bun", ["run", "src/index.ts"], {
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });

  beforeAll(async () => {
    await ensureIpdb();
    await waitForHealth();
  });

  afterAll(() => {
    server.kill();
  });

  test("health endpoint returns ok", async () => {
    const res = await fetch(healthUrl);

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  test("ip endpoint returns structured response", async () => {
    const res = await fetch(`${baseUrl}/api/ip`, {
      headers: {
        "x-forwarded-for": "1.2.3.4",
      },
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      ip: "1.2.3.4",
      source: "ip2region",
    });
    expect(body).toHaveProperty("location");
    expect(body).toHaveProperty("latencyMs");
    expect(body).toHaveProperty("attribution");
  });
});
