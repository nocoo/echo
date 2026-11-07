import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { defaultStateDir, defaultStorePath, hashApiKey, Store } from "../../src/lib/store.js";

let workDir: string;
let store: Store;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), "echo-store-"));
  store = new Store(path.join(workDir, "state", "echo.db"));
});

afterEach(() => {
  store.close();
  rmSync(workDir, { recursive: true, force: true });
});

describe("store paths", () => {
  test("defaults to the state directory", () => {
    const previous = process.env.STATE_DIR;
    process.env.STATE_DIR = "/tmp/echo-state";
    try {
      expect(defaultStateDir()).toBe("/tmp/echo-state");
      expect(defaultStorePath()).toBe(path.join("/tmp/echo-state", "echo.db"));
    } finally {
      if (previous === undefined) delete process.env.STATE_DIR;
      else process.env.STATE_DIR = previous;
    }
  });

  test("falls back to ./state", () => {
    const previous = process.env.STATE_DIR;
    delete process.env.STATE_DIR;
    try {
      expect(defaultStateDir()).toBe(path.resolve("state"));
      expect(defaultStorePath()).toBe(path.join(path.resolve("state"), "echo.db"));
    } finally {
      if (previous !== undefined) process.env.STATE_DIR = previous;
    }
  });
});

describe("api keys", () => {
  test("starts empty", () => {
    expect(store.listApiKeys()).toEqual([]);
  });

  test("creates a key with a one-time plaintext", () => {
    const created = store.createApiKey("ci key", "owner@example.com");

    expect(created.secret.startsWith("echo_")).toBe(true);
    expect(created.apiKey.key_prefix).toBe(created.secret.slice(0, 12));
    expect(created.apiKey.status).toBe("active");
    expect(created.apiKey.last_used_at).toBeNull();
    expect(created.apiKey.revoked_at).toBeNull();
    expect(created.apiKey.created_by).toBe("owner@example.com");
    expect(created.apiKey.created_at).toBeGreaterThan(0);

    const listed = store.listApiKeys();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.apiKey.id);
    expect(JSON.stringify(listed)).not.toContain(created.secret);
  });

  test("authenticates an active key and records usage", () => {
    const created = store.createApiKey("ci key", "owner@example.com");

    const found = store.findApiKeyBySecret(created.secret);
    expect(found?.id).toBe(created.apiKey.id);
    expect(found?.last_used_at).not.toBeNull();
    expect(store.listApiKeys()[0]?.last_used_at).not.toBeNull();
  });

  test("keeps the usage timestamp within the throttle window", () => {
    const created = store.createApiKey("ci key", "owner@example.com");

    const first = store.findApiKeyBySecret(created.secret);
    const second = store.findApiKeyBySecret(created.secret);

    expect(first?.last_used_at).not.toBeNull();
    expect(second?.last_used_at).toBe(first?.last_used_at);
  });

  test("rejects unknown and revoked keys", () => {
    expect(store.findApiKeyBySecret("echo_unknown")).toBeNull();

    const created = store.createApiKey("ci key", "owner@example.com");
    expect(store.revokeApiKey(created.apiKey.id)).toBe(true);
    expect(store.findApiKeyBySecret(created.secret)).toBeNull();
  });

  test("revokes only active keys", () => {
    const created = store.createApiKey("ci key", "owner@example.com");

    expect(store.revokeApiKey(created.apiKey.id)).toBe(true);
    expect(store.revokeApiKey(created.apiKey.id)).toBe(false);
    expect(store.revokeApiKey("missing")).toBe(false);

    const revoked = store.listApiKeys()[0];
    expect(revoked?.status).toBe("revoked");
    expect(revoked?.revoked_at).not.toBeNull();
  });

  test("hashes keys with sha256", () => {
    expect(hashApiKey("echo_secret")).toBe(hashApiKey("echo_secret"));
    expect(hashApiKey("echo_secret")).not.toBe(hashApiKey("echo_other"));
    expect(hashApiKey("echo_secret")).toHaveLength(64);
  });
});

describe("refresh runs", () => {
  test("starts without runs", () => {
    expect(store.listRefreshRuns()).toEqual([]);
    expect(store.latestRefreshRun()).toBeNull();
  });

  test("records a requested run", () => {
    const run = store.createRefreshRun("owner@example.com");

    expect(run.status).toBe("requested");
    expect(run.requested_by).toBe("owner@example.com");
    expect(run.finished_at).toBeNull();
    expect(run.detail).toBeNull();
    expect(store.latestRefreshRun()?.id).toBe(run.id);
  });

  test("updates run status", () => {
    const run = store.createRefreshRun("owner@example.com");

    expect(store.updateRefreshRun(run.id, "running")).toBe(true);
    expect(store.latestRefreshRun()?.status).toBe("running");

    expect(store.updateRefreshRun(run.id, "ok", "all good", true)).toBe(true);
    const finished = store.latestRefreshRun();
    expect(finished?.status).toBe("ok");
    expect(finished?.detail).toBe("all good");
    expect(finished?.finished_at).not.toBeNull();

    expect(store.updateRefreshRun("missing", "error")).toBe(false);
  });

  test("limits listed runs", () => {
    store.createRefreshRun("owner@example.com");
    store.createRefreshRun("owner@example.com");

    expect(store.listRefreshRuns(1)).toHaveLength(1);
    expect(store.listRefreshRuns()).toHaveLength(2);
  });
});
