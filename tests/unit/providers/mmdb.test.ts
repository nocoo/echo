import { describe, expect, test, vi, beforeEach } from "vitest";
import { openMmdb, resetMmdbCache } from "../../../src/services/providers/mmdb.js";

vi.mock("maxmind", () => {
  let callCount = 0;
  return {
    default: {
      open: vi.fn(async (filepath: string) => {
        callCount++;
        return { get: () => ({ filepath, callCount }) };
      }),
    },
  };
});

beforeEach(() => {
  resetMmdbCache();
});

describe("openMmdb", () => {
  test("opens a reader and caches it", async () => {
    const reader = await openMmdb("/path/to/test.mmdb");
    const result = reader.get("1.2.3.4") as Record<string, unknown> | null;
    expect(result).toMatchObject({ filepath: "/path/to/test.mmdb" });
  });

  test("returns cached reader on subsequent calls", async () => {
    const reader1 = await openMmdb("/path/to/test.mmdb");
    const reader2 = await openMmdb("/path/to/test.mmdb");
    expect(reader1).toBe(reader2);
  });

  test("opens different readers for different paths", async () => {
    const reader1 = await openMmdb("/path/to/a.mmdb");
    const reader2 = await openMmdb("/path/to/b.mmdb");
    expect(reader1).not.toBe(reader2);
  });

  test("resetMmdbCache clears all cached readers", async () => {
    const reader1 = await openMmdb("/path/to/test.mmdb");
    resetMmdbCache();
    const reader2 = await openMmdb("/path/to/test.mmdb");
    expect(reader1).not.toBe(reader2);
  });
});
