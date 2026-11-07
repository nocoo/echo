import { beforeEach, describe, expect, test, vi } from "vitest";

describe("resolveDataFile", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  test("resolves against the default data directory", async () => {
    const { resolveDataFile } = await import("../../src/lib/dataFile.js");
    const result = await resolveDataFile("test.mmdb");
    expect(result).toContain("data/test.mmdb");
  });

  test("honors an absolute configured database directory", async () => {
    vi.stubEnv("IPDB_DIR", "/isolated-ipdb-run");
    const { resolveDataFile } = await import("../../src/lib/dataFile.js");
    expect(await resolveDataFile("test.mmdb")).toBe("/isolated-ipdb-run/test.mmdb");
  });
});
