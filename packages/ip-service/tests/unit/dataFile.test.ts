import { beforeEach, describe, expect, test, vi } from "vitest";

const mockExistsSync = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();
const mockGunzipSync = vi.fn();

vi.mock("node:fs", () => ({ existsSync: mockExistsSync }));
vi.mock("node:fs/promises", () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
}));
vi.mock("node:zlib", () => ({ gunzipSync: mockGunzipSync }));

describe("resolveDataFile", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mockExistsSync.mockReset();
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
    mockMkdir.mockReset();
    mockGunzipSync.mockReset();
  });

  test("returns raw path when not on Vercel", async () => {
    vi.stubEnv("VERCEL", "");
    const { resolveDataFile } = await import("../../src/lib/dataFile.js");
    const result = await resolveDataFile("test.mmdb");
    expect(result).toContain("data/test.mmdb");
    expect(result).not.toContain("/tmp");
  });

  test("decompresses .gz to /tmp on Vercel (cold start)", async () => {
    vi.stubEnv("VERCEL", "1");
    mockExistsSync.mockReturnValue(false);
    mockMkdir.mockResolvedValue(undefined);
    const fakeGz = Buffer.from("gz");
    const fakeRaw = Buffer.from("raw");
    mockReadFile.mockResolvedValue(fakeGz);
    mockGunzipSync.mockReturnValue(fakeRaw);
    mockWriteFile.mockResolvedValue(undefined);

    const { resolveDataFile } = await import("../../src/lib/dataFile.js");
    const result = await resolveDataFile("test.mmdb");

    expect(result).toBe("/tmp/echo-data/test.mmdb");
    expect(mockMkdir).toHaveBeenCalledWith("/tmp/echo-data", { recursive: true });
    expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining("test.mmdb.gz"));
    expect(mockGunzipSync).toHaveBeenCalledWith(fakeGz);
    expect(mockWriteFile).toHaveBeenCalledWith("/tmp/echo-data/test.mmdb", fakeRaw);
  });

  test("skips decompression if /tmp file exists (warm start)", async () => {
    vi.stubEnv("VERCEL", "1");
    mockExistsSync.mockReturnValue(true);

    const { resolveDataFile } = await import("../../src/lib/dataFile.js");
    const result = await resolveDataFile("test.mmdb");

    expect(result).toBe("/tmp/echo-data/test.mmdb");
    expect(mockReadFile).not.toHaveBeenCalled();
  });
});
