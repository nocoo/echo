import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { Store } from "../../src/lib/store.js";
import { createApp } from "../../src/server.js";

let root: string;
let dashboardDir: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "echo-static-"));
  dashboardDir = path.join(root, "dist");
  mkdirSync(path.join(dashboardDir, "assets"), { recursive: true });
  writeFileSync(path.join(dashboardDir, "index.html"), "<!doctype html><title>Echo admin</title>");
  writeFileSync(path.join(dashboardDir, "assets", "index-abc.js"), "export const x = 1;");
  writeFileSync(path.join(dashboardDir, "assets", "index-abc.css"), "body{color:red}");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function createStaticApp(dashboardDirOverride?: string) {
  return createApp(async () => null, {
    store: new Store(":memory:"),
    dashboardDir: dashboardDirOverride ?? dashboardDir,
  });
}

describe("dashboard static serving", () => {
  test("serves the console shell", async () => {
    const res = await createStaticApp().request("/admin");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await res.text()).toContain("<title>Echo admin</title>");
  });

  test("falls back to the shell for extension-less routes", async () => {
    const res = await createStaticApp().request("/admin/tools");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await res.text()).toContain("<title>Echo admin</title>");
  });

  test("serves built assets", async () => {
    const res = await createStaticApp().request("/admin/assets/index-abc.js");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(await res.text()).toContain("export const x = 1;");
  });

  test("serves stylesheets with a css content type", async () => {
    const res = await createStaticApp().request("/admin/assets/index-abc.css");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/css; charset=utf-8");
  });

  test("returns 404 for a missing asset", async () => {
    const res = await createStaticApp().request("/admin/assets/missing.js");

    expect(res.status).toBe(404);
  });

  test("returns 404 for an extension under the console path", async () => {
    const res = await createStaticApp().request("/admin/missing.js");

    expect(res.status).toBe(404);
  });

  test("returns 404 when the dashboard build is missing", async () => {
    const res = await createStaticApp(path.join(root, "missing")).request("/admin");

    expect(res.status).toBe(404);
  });
});

describe("public contract", () => {
  test("keeps the root json self description", async () => {
    const res = await createStaticApp().request("/");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toMatchObject({ name: "echo", status: "ok" });
  });

  test("answers unknown api paths with json", async () => {
    const res = await createStaticApp().request("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toMatchObject({ error: { code: "not_found" } });
  });

  test("does not answer api paths with the console shell", async () => {
    const res = await createStaticApp().request("/api/tools");

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
