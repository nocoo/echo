import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";

const healthUrl = "http://127.0.0.1:3000/health";

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

describe("api e2e", () => {
  const port = 3000;
  const server = spawn("bun", ["run", "src/index.ts"], {
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });

  beforeAll(async () => {
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
});
