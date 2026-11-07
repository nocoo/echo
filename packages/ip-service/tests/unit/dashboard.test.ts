import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  defaultDashboardDir,
  isSpaRoute,
  readDashboardAsset,
  readDashboardIndex,
  resolveDashboardDir,
} from "../../src/lib/dashboard.js";

let root: string;
let dashboardDir: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "echo-dashboard-"));
  dashboardDir = path.join(root, "dist");
  mkdirSync(path.join(dashboardDir, "assets"), { recursive: true });
  writeFileSync(path.join(dashboardDir, "index.html"), "<!doctype html><title>Echo</title>");
  writeFileSync(path.join(dashboardDir, "assets", "index-abc.js"), "export const x = 1;");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("dashboard directory", () => {
  test("defaults to the sibling dashboard package build", () => {
    expect(defaultDashboardDir().endsWith(path.join("packages", "dashboard", "dist"))).toBe(true);
  });

  test("prefers the explicit directory", () => {
    expect(resolveDashboardDir("/tmp/explicit")).toBe("/tmp/explicit");
  });

  test("prefers the environment variable", () => {
    const previous = process.env.DASHBOARD_DIR;
    process.env.DASHBOARD_DIR = "/tmp/from-env";
    try {
      expect(resolveDashboardDir()).toBe("/tmp/from-env");
      expect(resolveDashboardDir("/tmp/explicit")).toBe("/tmp/explicit");
    } finally {
      if (previous === undefined) delete process.env.DASHBOARD_DIR;
      else process.env.DASHBOARD_DIR = previous;
    }
  });
});

describe("spa routes", () => {
  test("matches the console root and extension-less paths", () => {
    expect(isSpaRoute("/admin")).toBe(true);
    expect(isSpaRoute("/admin/tools")).toBe(true);
    expect(isSpaRoute("/admin/keys/123")).toBe(true);
  });

  test("rejects paths with a file extension and unrelated paths", () => {
    expect(isSpaRoute("/admin/assets/index-abc.js")).toBe(false);
    expect(isSpaRoute("/admin/")).toBe(false);
    expect(isSpaRoute("/api/ip")).toBe(false);
  });
});

describe("asset reading", () => {
  test("reads the index and assets", async () => {
    const index = await readDashboardIndex(dashboardDir);
    expect(index).not.toBeNull();
    expect(index?.contentType).toBe("text/html; charset=utf-8");
    expect(new TextDecoder().decode(index?.body)).toContain("<title>Echo</title>");

    const asset = await readDashboardAsset(dashboardDir, "assets/index-abc.js");
    expect(asset?.contentType).toBe("text/javascript; charset=utf-8");
    expect(new TextDecoder().decode(asset?.body)).toContain("export const x = 1;");
  });

  test("returns null for missing files and directories", async () => {
    expect(await readDashboardIndex(path.join(root, "missing"))).toBeNull();
    expect(await readDashboardAsset(dashboardDir, "assets/missing.js")).toBeNull();
    expect(await readDashboardAsset(dashboardDir, "assets")).toBeNull();
  });

  test("refuses to escape the dashboard directory", async () => {
    expect(await readDashboardAsset(dashboardDir, "../secret.txt")).toBeNull();
    expect(await readDashboardAsset(dashboardDir, "../../etc/passwd")).toBeNull();
  });

  test("falls back to a binary content type", async () => {
    writeFileSync(path.join(dashboardDir, "assets", "font.bin"), "x");
    const asset = await readDashboardAsset(dashboardDir, "assets/font.bin");
    expect(asset?.contentType).toBe("application/octet-stream");
  });
});
